// POST /api/inventory/interpret
// Recibe: multipart/form-data con:
//   - files: uno o varios archivos (imágenes o PDF)
//   - tipoCarga: "actual" | "base"
// La API key SOLO vive aquí (variable de entorno del servidor). Nunca llega al navegador.

const MAX_ARCHIVOS = 12;
const MAX_BYTES_POR_ARCHIVO = 8 * 1024 * 1024;

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const envKeys = Object.keys(process.env).filter((k) => k.toUpperCase().includes("ANTHROP"));
      return json({
        status: "server_error",
        message: "El servidor no tiene configurada ANTHROPIC_API_KEY.",
        debug: {
          totalVariablesDeEntorno: Object.keys(process.env).length,
          variablesConAnthropicEnElNombre: envKeys,
          entornoVercel: process.env.VERCEL_ENV || "desconocido",
        },
      }, 500);
    }

    const formData = await request.formData();
    const tipoCarga = formData.get("tipoCarga") || "actual";
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return json({ status: "empty", message: "No se recibió ningún archivo." }, 400);
    }
    if (files.length > MAX_ARCHIVOS) {
      return json({ status: "server_error", message: `Demasiados archivos (máximo ${MAX_ARCHIVOS}).` }, 400);
    }

    const content = [];
    for (const file of files) {
      if (typeof file === "string") continue;
      if (file.size > MAX_BYTES_POR_ARCHIVO) {
        return json({ status: "server_error", message: `El archivo "${file.name}" pesa demasiado (máx. 8MB).` }, 400);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");
      const isPdf = file.type === "application/pdf";
      content.push(
        isPdf
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
          : { type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } }
      );
    }

    const contexto = tipoCarga === "base"
      ? "Este documento es la BASE de temporada (columna tipo BAR/INICIAL): cantidad objetivo de botellas cerradas. Normalmente sin fracción de botella abierta."
      : "Este documento es el inventario ACTUAL/CIERRE de hoy: puede incluir botellas cerradas y una botella de trabajo (abierta) parcialmente consumida.";

    const instrucciones = `Estas imágenes/documentos son fotos o capturas de un conteo de inventario de bar, manuscrito o en planilla, y pueden ser varias partes de un MISMO inventario — trátalas como una sola sesión. ${contexto}

Para cada producto que identifiques, no conviertas cantidades como "2 + 0,5" a un solo decimal. Separa:
- closed_units: número de botellas cerradas completas (ej. 2)
- open_fraction: fracción de una botella de trabajo abierta, entre 0 y 1 (ej. 0,5). Usa null si no aplica.

Si el mismo producto aparece en más de un archivo, suma closed_units entre archivos (no dupliques la línea).

Incluye confidence (0 a 1) y needs_review (true si un humano debería revisar esa línea).

Responde ÚNICAMENTE con un objeto JSON, sin texto adicional, sin markdown:
{"items":[{"raw_name":"nombre tal como aparece","closed_units":numero_o_null,"open_fraction":numero_o_null,"confidence":numero,"needs_review":booleano}]}

No inventes productos que no estén escritos.`;

    content.push({ type: "text", text: instrucciones });

    let response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 8000,
          messages: [{ role: "user", content }],
        }),
      });
    } catch (e) {
      return json({ status: "network_error", message: "No se pudo contactar a Anthropic desde el servidor." }, 502);
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      return json({
        status: "rate_limited",
        message: "El servicio de IA está temporalmente ocupado. Tus archivos siguen cargados.",
        retryAfterSeconds: retryAfter ? Number(retryAfter) : null,
      }, 200);
    }
    if (response.status === 401 || response.status === 403) {
      return json({ status: "auth_error", message: "La clave de API del servidor no es válida o expiró." }, 200);
    }
    if (response.status >= 500) {
      return json({ status: "server_error", message: "Anthropic tuvo un problema interno. Intenta de nuevo." }, 200);
    }
    if (!response.ok) {
      let detail = "";
      try { const j = await response.json(); detail = j?.error?.message || ""; } catch {}
      return json({ status: "server_error", message: detail || `Error HTTP ${response.status}` }, 200);
    }

    const data = await response.json();
    if (!Array.isArray(data.content) || data.content.length === 0) {
      return json({ status: "parse_error", message: "La respuesta de la IA no trajo contenido." }, 200);
    }

    const textBlock = data.content.map((b) => b.text || "").join("\n");
    let clean = textBlock.replace(/```json|```/g, "").trim();
    const objMatch = clean.match(/\{[\s\S]*\}/);
    if (objMatch) clean = objMatch[0];

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { return json({ status: "parse_error", message: "No se pudo leer el resultado de la IA como JSON.", raw: textBlock.slice(0, 300) }, 200); }

    const itemsRaw = Array.isArray(parsed.items) ? parsed.items : null;
    if (!itemsRaw) return json({ status: "parse_error", message: "El resultado no tiene el formato esperado (falta 'items')." }, 200);

    const items = itemsRaw
      .filter((r) => r && typeof r === "object" && typeof r.raw_name === "string" && r.raw_name.trim().length > 0)
      .map((r) => {
        const closedUnits = typeof r.closed_units === "number" ? r.closed_units : (r.closed_units == null ? null : Number(r.closed_units));
        const openFraction = typeof r.open_fraction === "number" ? Math.max(0, Math.min(1, r.open_fraction)) : null;
        const confidence = typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : 0.5;
        const needsReview = !!r.needs_review || confidence < 0.75 || closedUnits === null || Number.isNaN(closedUnits);
        return { rawName: r.raw_name.trim(), closedUnits, openFraction, confidence, needsReview };
      });

    if (items.length === 0) return json({ status: "empty", message: "No se detectó ningún producto en los archivos." }, 200);
    return json({ status: "ok", items }, 200);
  } catch (e) {
    console.error("Error inesperado en /api/inventory/interpret:", e);
    return json({ status: "server_error", message: "Error inesperado en el servidor." }, 500);
  }
}

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
