
import { useState } from "react";
import Link from "next/link";

const niveles = [
  { id: "normal", label: "Normal", detalle: "Temporada baja" },
  { id: "medio", label: "Medio", detalle: "Temporada media" },
  { id: "alto", label: "Alto", detalle: "Alta temporada / eventos" },
];

const ubicaciones = [
  { id: "bar", label: "Bar" },
  { id: "bodega", label: "Bodega" },
];

// Comprime una imagen en el navegador antes de enviarla,
// para no pasar el límite de 4.5MB por request de Vercel.
// Devuelve un Blob (no base64), porque el backend espera multipart/form-data.
function comprimirImagen(file, maxWidth = 1600, calidad = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * escala;
        canvas.height = img.height * escala;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve({ blob, preview: canvas.toDataURL("image/jpeg", calidad) });
            else reject(new Error("No se pudo comprimir la imagen"));
          },
          "image/jpeg",
          calidad
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Normaliza texto para comparar nombres (minúsculas, sin acentos, sin espacios extra)
function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function Pedido() {
  const [paso, setPaso] = useState("config"); // config | fotos | revisar | comparar
  const [nivel, setNivel] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [fotos, setFotos] = useState([]); // { preview, blob }
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [comparacion, setComparacion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  async function manejarSeleccionFotos(e) {
    const archivos = Array.from(e.target.files || []);
    if (archivos.length === 0) return;

    setError(null);
    const nuevas = [];
    for (const file of archivos) {
      try {
        const { blob, preview } = await comprimirImagen(file);
        nuevas.push({ preview, blob });
      } catch {
        setError("No se pudo procesar una de las imágenes. Intenta de nuevo.");
      }
    }
    setFotos((prev) => [...prev, ...nuevas]);
  }

  function quitarFoto(index) {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  }

  function actualizarItem(index, campo, valor) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [campo]: valor } : it))
    );
  }

  async function interpretarConIA() {
    if (fotos.length === 0) {
      setError("Sube al menos una foto del inventario.");
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const formData = new FormData();
      fotos.forEach((f, i) => {
        formData.append("files", f.blob, `foto-${i + 1}.jpg`);
      });
      formData.append("tipoCarga", "actual");
      if (ubicacion) formData.append("ubicacion", ubicacion);

      const res = await fetch("/api/inventory/interpret", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.status === "rate_limited") {
        setError(
          "El servicio de IA está ocupado por ahora. Tus fotos siguen cargadas, intenta de nuevo en unos segundos."
        );
        return;
      }
      if (data.status !== "ok") {
        setError(data.message || "No se pudo interpretar el inventario.");
        return;
      }

      setItems(data.items);
      setPaso("revisar");
    } catch (err) {
      setError("No se pudo conectar con el servidor. " + err.message);
    } finally {
      setCargando(false);
    }
  }

  async function compararConCatalogo() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/productos");
      const data = await res.json();
      if (data.status !== "ok") {
        setError(data.message || "No se pudo cargar el catálogo de productos.");
        return;
      }
      setCatalogo(data.productos);

      const objetivoCampo =
        nivel === "normal" ? "stock_normal" : nivel === "medio" ? "stock_medio" : "stock_alto";
      const stockCampo = ubicacion === "bar" ? "stock_bar" : "stock_bodega";

      const filas = items.map((it) => {
        const cantidadDetectada = (it.closedUnits || 0) + (it.openFraction || 0);
        const nombreNormalizado = normalizar(it.rawName);
        const match = data.productos.find(
          (p) => normalizar(p.nombre) === nombreNormalizado
        );
        const objetivo = match ? match[objetivoCampo] || 0 : null;
        const diferencia = match ? Math.max(0, objetivo - cantidadDetectada) : null;

        return {
          rawName: it.rawName,
          cantidadDetectada,
          productoId: match ? match.id : null,
          nombreProducto: match ? match.nombre : null,
          objetivo,
          diferencia,
        };
      });

      setComparacion(filas);
      setPaso("comparar");
    } catch (err) {
      setError("No se pudo conectar con el catálogo. " + err.message);
    } finally {
      setCargando(false);
    }
  }

  function asignarProducto(index, productoId) {
    const producto = catalogo.find((p) => p.id === productoId);
    const objetivoCampo =
      nivel === "normal" ? "stock_normal" : nivel === "medio" ? "stock_medio" : "stock_alto";
    setComparacion((prev) =>
      prev.map((fila, i) => {
        if (i !== index) return fila;
        if (!producto) {
          return { ...fila, productoId: null, nombreProducto: null, objetivo: null, diferencia: null };
        }
        const objetivo = producto[objetivoCampo] || 0;
        return {
          ...fila,
          productoId: producto.id,
          nombreProducto: producto.nombre,
          objetivo,
          diferencia: Math.max(0, objetivo - fila.cantidadDetectada),
        };
      })
    );
  }

  async function guardarConteo() {
    setGuardando(true);
    setError(null);
    try {
      const stockCampo = ubicacion === "bar" ? "stock_bar" : "stock_bodega";
      const productosActualizados = comparacion
        .filter((f) => f.productoId)
        .map((f) => {
          const original = catalogo.find((p) => p.id === f.productoId);
          return {
            id: original.id,
            nombre: original.nombre,
            categoria: original.categoria,
            unidad: original.unidad,
            stockNormal: original.stock_normal,
            stockMedio: original.stock_medio,
            stockAlto: original.stock_alto,
            stockBar: stockCampo === "stock_bar" ? f.cantidadDetectada : original.stock_bar,
            stockBodega: stockCampo === "stock_bodega" ? f.cantidadDetectada : original.stock_bodega,
            estado: original.estado,
          };
        });

      if (productosActualizados.length === 0) {
        setError("No hay productos identificados para guardar.");
        return;
      }

      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productos: productosActualizados }),
      });
      const data = await res.json();
      if (data.status !== "ok") {
        setError(data.message || "No se pudo guardar el conteo.");
        return;
      }
      setGuardado(true);
    } catch (err) {
      setError("No se pudo guardar. " + err.message);
    } finally {
      setGuardando(false);
    }
  }

  const colores = {
    fondo: "linear-gradient(180deg, #0B1420 0%, #10202B 100%)",
    tarjeta: "#16232E",
    borde: "#24333F",
    texto: "#F2EFE9",
    textoSecundario: "#9FB0BA",
    acento: "#2DD4BF",
    dorado: "#E3B04B",
    alerta: "#F59E0B",
  };

  return (
    <main
      style={{
        background: colores.fondo,
        minHeight: "100vh",
        color: colores.texto,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ marginBottom: "24px" }}>
          <Link
            href="/"
            style={{ color: colores.textoSecundario, textDecoration: "none", fontSize: "14px" }}
          >
            ← Inicio
          </Link>
        </div>

        <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>
          Hacer pedido semanal
        </h1>
        <p style={{ color: colores.textoSecundario, marginBottom: "32px" }}>
          {paso === "config" && "Paso 1 de 3 — Nivel y ubicación"}
          {paso === "fotos" && "Paso 2 de 3 — Sube las fotos del inventario"}
          {paso === "revisar" && "Paso 3 de 3 — Revisa lo detectado"}
        </p>

        {/* Paso 1: nivel + ubicación */}
        {paso === "config" && (
          <div>
            <p style={{ fontWeight: 600, marginBottom: "12px" }}>Nivel de operación</p>
            <div style={{ display: "grid", gap: "10px", marginBottom: "28px" }}>
              {niveles.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setNivel(n.id)}
                  style={{
                    textAlign: "left",
                    background: colores.tarjeta,
                    border: `1px solid ${nivel === n.id ? colores.acento : colores.borde}`,
                    borderRadius: "14px",
                    padding: "16px",
                    color: colores.texto,
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: 700,
                  }}
                >
                  {n.label}
                  <div style={{ color: colores.textoSecundario, fontWeight: 400, fontSize: "13px" }}>
                    {n.detalle}
                  </div>
                </button>
              ))}
            </div>

            <p style={{ fontWeight: 600, marginBottom: "12px" }}>Ubicación</p>
            <div style={{ display: "flex", gap: "10px", marginBottom: "28px" }}>
              {ubicaciones.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setUbicacion(u.id)}
                  style={{
                    flex: 1,
                    background: colores.tarjeta,
                    border: `1px solid ${ubicacion === u.id ? colores.acento : colores.borde}`,
                    borderRadius: "14px",
                    padding: "16px",
                    color: colores.texto,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {u.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPaso("fotos")}
              disabled={!nivel || !ubicacion}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "12px",
                border: "none",
                background: nivel && ubicacion ? colores.dorado : colores.borde,
                color: "#0B1420",
                fontWeight: 700,
                fontSize: "16px",
                cursor: nivel && ubicacion ? "pointer" : "default",
              }}
            >
              Continuar
            </button>
          </div>
        )}

        {/* Paso 2: subir fotos */}
        {paso === "fotos" && (
          <div>
            <p style={{ marginBottom: "16px", color: colores.textoSecundario }}>
              <strong style={{ color: colores.acento }}>
                {niveles.find((n) => n.id === nivel)?.label}
              </strong>{" "}
              ·{" "}
              <strong style={{ color: colores.acento }}>
                {ubicaciones.find((u) => u.id === ubicacion)?.label}
              </strong>{" "}
              <button
                onClick={() => setPaso("config")}
                style={{
                  background: "none",
                  border: "none",
                  color: colores.textoSecundario,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                cambiar
              </button>
            </p>

            <label
              style={{
                display: "block",
                textAlign: "center",
                background: colores.tarjeta,
                border: `1px dashed ${colores.borde}`,
                borderRadius: "16px",
                padding: "32px",
                cursor: "pointer",
                marginBottom: "16px",
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={manejarSeleccionFotos}
                style={{ display: "none" }}
              />
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>📸</div>
              <div>Toca para tomar o subir fotos</div>
              <div style={{ color: colores.textoSecundario, fontSize: "13px" }}>
                Puedes subir varias a la vez
              </div>
            </label>

            {fotos.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "8px",
                  marginBottom: "16px",
                }}
              >
                {fotos.map((f, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img
                      src={f.preview}
                      alt={`Foto ${i + 1}`}
                      style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "8px" }}
                    />
                    <button
                      onClick={() => quitarFoto(i)}
                      style={{
                        position: "absolute",
                        top: "4px",
                        right: "4px",
                        background: "#0B1420",
                        color: colores.texto,
                        border: "none",
                        borderRadius: "999px",
                        width: "22px",
                        height: "22px",
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p style={{ color: "#F87171", marginBottom: "16px" }}>{error}</p>}

            <button
              onClick={interpretarConIA}
              disabled={cargando || fotos.length === 0}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "12px",
                border: "none",
                background: cargando ? colores.borde : colores.dorado,
                color: "#0B1420",
                fontWeight: 700,
                fontSize: "16px",
                cursor: cargando ? "default" : "pointer",
              }}
            >
              {cargando ? "Interpretando con IA..." : "Interpretar con IA"}
            </button>
          </div>
        )}

        {/* Paso 3: revisar items detectados */}
        {paso === "revisar" && items && (
          <div>
            {items.length === 0 && (
              <p style={{ color: colores.textoSecundario }}>
                No se detectó ningún producto en las fotos.
              </p>
            )}

            <div style={{ display: "grid", gap: "10px", marginBottom: "24px" }}>
              {items.map((it, i) => (
                <div
                  key={i}
                  style={{
                    background: colores.tarjeta,
                    border: `1px solid ${it.needsReview ? colores.alerta : colores.borde}`,
                    borderRadius: "14px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontWeight: 700 }}>{it.rawName}</span>
                    {it.needsReview && (
                      <span style={{ color: colores.alerta, fontSize: "12px", fontWeight: 700 }}>
                        Revisar
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <label style={{ flex: 1, fontSize: "13px", color: colores.textoSecundario }}>
                      Botellas cerradas
                      <input
                        type="number"
                        value={it.closedUnits ?? ""}
                        onChange={(e) => actualizarItem(i, "closedUnits", Number(e.target.value))}
                        style={{
                          display: "block",
                          width: "100%",
                          marginTop: "4px",
                          padding: "10px",
                          borderRadius: "8px",
                          border: `1px solid ${colores.borde}`,
                          background: "#0B1420",
                          color: colores.texto,
                        }}
                      />
                    </label>
                    <label style={{ flex: 1, fontSize: "13px", color: colores.textoSecundario }}>
                      Fracción abierta
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={it.openFraction ?? ""}
                        onChange={(e) => actualizarItem(i, "openFraction", Number(e.target.value))}
                        style={{
                          display: "block",
                          width: "100%",
                          marginTop: "4px",
                          padding: "10px",
                          borderRadius: "8px",
                          border: `1px solid ${colores.borde}`,
                          background: "#0B1420",
                          color: colores.texto,
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {error && <p style={{ color: "#F87171", marginBottom: "16px" }}>{error}</p>}

            <button
              onClick={compararConCatalogo}
              disabled={cargando}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "12px",
                border: "none",
                background: cargando ? colores.borde : colores.dorado,
                color: "#0B1420",
                fontWeight: 700,
                fontSize: "16px",
                cursor: cargando ? "default" : "pointer",
              }}
            >
              {cargando ? "Comparando..." : "Comparar con catálogo"}
            </button>
          </div>
        )}

        {/* Paso 4: comparar contra catálogo y guardar */}
        {paso === "comparar" && comparacion && (
          <div>
            <div style={{ display: "grid", gap: "10px", marginBottom: "24px" }}>
              {comparacion.map((f, i) => (
                <div
                  key={i}
                  style={{
                    background: colores.tarjeta,
                    border: `1px solid ${f.productoId ? colores.borde : colores.alerta}`,
                    borderRadius: "14px",
                    padding: "16px",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: "8px" }}>{f.rawName}</div>

                  {!f.productoId && (
                    <div style={{ marginBottom: "8px" }}>
                      <span style={{ color: colores.alerta, fontSize: "12px", fontWeight: 700 }}>
                        No coincide con ningún producto del catálogo
                      </span>
                      <select
                        onChange={(e) => asignarProducto(i, e.target.value || null)}
                        defaultValue=""
                        style={{
                          display: "block",
                          width: "100%",
                          marginTop: "6px",
                          padding: "10px",
                          borderRadius: "8px",
                          border: `1px solid ${colores.borde}`,
                          background: "#0B1420",
                          color: colores.texto,
                        }}
                      >
                        <option value="">Elegir producto manualmente...</option>
                        {catalogo.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {f.productoId && (
                    <div style={{ display: "flex", gap: "16px", fontSize: "14px", color: colores.textoSecundario }}>
                      <span>Detectado: <strong style={{ color: colores.texto }}>{f.cantidadDetectada}</strong></span>
                      <span>Objetivo: <strong style={{ color: colores.texto }}>{f.objetivo}</strong></span>
                      <span>Falta: <strong style={{ color: colores.dorado }}>{f.diferencia}</strong></span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error && <p style={{ color: "#F87171", marginBottom: "16px" }}>{error}</p>}

            {guardado ? (
              <p style={{ color: colores.acento, fontWeight: 700 }}>
                ✓ Conteo guardado en {ubicaciones.find((u) => u.id === ubicacion)?.label}.
              </p>
            ) : (
              <button
                onClick={guardarConteo}
                disabled={guardando}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "none",
                  background: guardando ? colores.borde : colores.dorado,
                  color: "#0B1420",
                  fontWeight: 700,
                  fontSize: "16px",
                  cursor: guardando ? "default" : "pointer",
                }}
              >
                {guardando ? "Guardando..." : "Guardar conteo"}
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
