// POST /api/precios/interpret
// Recibe: multipart/form-data con:
//   - files: uno o varios archivos (imágenes, PDF, o Excel .xlsx)
//   - proveedorId: id del proveedor al que pertenecen estos precios
// Devuelve: { status: "ok"|"rate_limited"|"auth_error"|"server_error"|"parse_error"|"empty",
//             items?: [{ rawName, precio, confidence, needsReview }],
//             message? }
//
// Imágenes y PDF se interpretan con IA (igual que inventario).
// Excel (.xlsx) se lee directamente con exceljs, sin usar IA.

import ExcelJS from "exceljs";

const MAX_ARCHIVOS = 12;
const MAX_BYTES_POR_ARCHIVO = 8 * 1024 * 1024; // 8MB

const PALABRAS_PRODUCTO = ["producto", "nombre", "articulo", "artículo", "item", "descripcion", "descripción"];
const PALABRAS_PRECIO = ["precio", "valor", "costo", "$"];

export async function POST(request) {
  try {
    const formData = await request.formData();
    const proveedorId = formData.get("proveedorId") || null;
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return json({ status: "empty", message: "No se recibió ningún archivo." }, 400);
    }
    if (files.length > MAX_ARCHIVOS) {
      return json({ status: "server_error", message: `Demasiados archivos (máximo ${MAX_ARCHIVOS}).` }, 400);
    }

    const archivosExcel = [];
    const archivosParaIA = [];

    for (const file of files) {
      if (typeof file === "string") continue;
      if (file.size > MAX_BYTES_POR_ARCHIVO) {
        return json({ status: "server_error", message: `El archivo "${file.name}" pesa demasiado (máx. 8MB).` }, 400);
      }
      const esExcel =
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        (file.name || "").toLowerCase().endsWith(".xlsx");
      if (esExcel) {
        archivosExcel.push(file);
      } else {
        archivosParaIA.push(file);
      }
    }

    let itemsExcel = [];
    if (archivosExcel.length > 0) {
      try {
        itemsExcel = await leerExcels(archivosExcel);
      } catch (e) {
        return json({ status: "parse_error", message: "No se pudo leer el archivo Excel: " + e.message }, 200);
      }
    }

    let itemsIA = [];
    if (archivosParaIA.length > 0) {
      const resultado = await interpretarConIA(archivosParaIA);
      if (resultado.status !== "ok") {
        // Si hubo Excel válido, no perdemos ese resultado por un problema en las imágenes.
        if (itemsExcel.length > 0) {
          return json({ status: "ok", items: itemsExcel, avisoIA: resultado.message }, 200);
        }
        return json(resultado, 200);
      }
      itemsIA = resultado.items;
    }

    const items = [...itemsExcel, ...itemsIA];
    if (items.length === 0) {
      return json({ status: "empty", message: "No se detectó ningún producto con precio en los archivos." }, 200);
    }
    return json({ status: "ok", items, proveedorId }, 200);
  } catch (e) {
    console.error("Error inesperado en /api/precios/interpret:", e);
    return json({ status: "server_error", message: "Error inesperado en el servidor." }, 500);
  }
}

async function leerExcels(archivos) {
  const items = [];
  for (const file of archivos) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const hoja = workbook.worksheets[0];
    if (!hoja) continue;

    let colProducto = null;
    let colPrecio = null;
    const filaEncabezado = hoja.getRow(1);
    filaEncabezado.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const valor = String(cell.value || "").toLowerCase().trim();
      if (colProducto === null && PALABRAS_PRODUCTO.some((p) => valor.includes(p))) colProducto = colNumber;
      if (colPrecio === null && PALABRAS_PRECIO.some((p) => valor.includes(p))) colPrecio = colNumber;
    });
    if (colProducto === null) colProducto = 1;
    if (colPrecio === null) colPrecio = 2;

    hoja.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // encabezado
      const nombreRaw = row.getCell(colProducto).value;
      const precioRaw = row.getCell(colPrecio).value;
      const nombre = nombreRaw == null ? "" : String(nombreRaw).trim();
      const precioNum = typeof precioRaw === "number" ? precioRaw : Number(String(precioRaw || "").replace(/[^0-9.,]/g, "").replace(",", "."));
      if (!nombre || Number.isNaN(precioNum) || precioNum <= 0) return;
      items.push({ rawName: nombre, precio: precioNum, confidence: 1, needsReview: false });
    });
  }
  return items;
}

async function interpretarConIA(files) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: "server_error", message: "El servidor no tiene configurada ANTHROPIC_API_KEY." };
  }

  const content = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const isPdf = file.type === "application/pdf";
    content.push(
      isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } }
    );
  }

  const instrucciones = `Estas imágenes o documentos son listas de precios de un proveedor de bar/restaurante. Pueden ser fotos, capturas, o PDFs escaneados, manuscritos o impresos.

Para cada producto que identifiques, extrae:
- raw_name: el nombre del producto tal como aparece
- precio: el precio unitario como número (sin símbolo de moneda, sin separadores de miles; usa punto decimal)

Si el mismo producto aparece varias veces en distintos archivos, usa el precio más reciente o más claro (no dupliques la línea).

Incluye confidence (0 a 1) y needs_review (true si un humano debería revisar esa línea, por ejemplo si el precio o el nombre es difícil de leer con certeza).

Responde ÚNICAMENTE con un objeto JSON, sin texto adicional, sin markdown:
{"items":[{"raw_name":"nombre tal como aparece","precio":numero,"confidence":numero,"needs_review":booleano}]}

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
        max_tokens: 12000,
        thinking: { type: "disabled" },
        messages: [{ role: "user", content }],
      }),
    });
  } catch (e) {
    return { status: "network_error", message: "No se pudo contactar a Anthropic desde el servidor." };
  }

  if (response.status === 429) {
    return { status: "rate_limited", message: "El servicio de IA está temporalmente ocupado." };
  }
  if (response.status === 401 || response.status === 403) {
    return { status: "auth_error", message: "La clave de API del servidor no es válida o expiró." };
  }
  if (response.status >= 500) {
    return { status: "server_error", message: "Anthropic tuvo un problema interno. Intenta de nuevo." };
  }
  if (!response.ok) {
    let detail = "";
    try { const j = await response.json(); detail = j?.error?.message || ""; } catch { /* sin detalle */ }
    return { status: "server_error", message: detail || `Error HTTP ${response.status}` };
  }

  const data = await response.json();
  if (!Array.isArray(data.content) || data.content.length === 0) {
    return { status: "parse_error", message: "La respuesta de la IA no trajo contenido." };
  }

  const textBlock = data.content.map((b) => b.text || "").join("\n");
  let clean = textBlock.replace(/```json|```/g, "").trim();
  const objMatch = clean.match(/\{[\s\S]*\}/);
  if (objMatch) clean = objMatch[0];

  let parsed;
  try { parsed = JSON.parse(clean); }
  catch {
    return { status: "parse_error", message: "No se pudo leer el resultado de la IA como JSON." };
  }

  const itemsRaw = Array.isArray(parsed.items) ? parsed.items : null;
  if (!itemsRaw) return { status: "parse_error", message: "El resultado no tiene el formato esperado (falta 'items')." };

  const items = itemsRaw
    .filter((r) => r && typeof r === "object" && typeof r.raw_name === "string" && r.raw_name.trim().length > 0)
    .map((r) => {
      const precio = typeof r.precio === "number" ? r.precio : Number(r.precio);
      const confidence = typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : 0.5;
      const needsReview = !!r.needs_review || confidence < 0.75 || Number.isNaN(precio) || precio <= 0;
      return { rawName: r.raw_name.trim(), precio: Number.isNaN(precio) ? 0 : precio, confidence, needsReview };
    })
    .filter((it) => it.precio > 0 || it.needsReview);

  if (items.length === 0) return { status: "empty", message: "No se detectó ningún producto con precio en los archivos." };
  return { status: "ok", items };
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
