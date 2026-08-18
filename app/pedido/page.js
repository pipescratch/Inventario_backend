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

export default function Pedido() {
  const [paso, setPaso] = useState("config"); // config | fotos | revisar
  const [nivel, setNivel] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [fotos, setFotos] = useState([]); // { preview, blob }
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState(null);

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
                capture="environment"
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

            <p style={{ color: colores.textoSecundario, fontSize: "13px" }}>
              Siguiente paso: cruzar estos nombres contra tu catálogo de productos en
              Supabase y calcular cuánto falta según el nivel {niveles.find((n) => n.id === nivel)?.label}.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
