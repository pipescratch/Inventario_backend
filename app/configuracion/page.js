"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

let contadorLocal = 0;
function idLocal() {
  contadorLocal += 1;
  return `local-${contadorLocal}`;
}

// Carga jsPDF desde cdnjs solo cuando hace falta.
let cargandoJsPDF = null;
function asegurarJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (cargandoJsPDF) return cargandoJsPDF;
  cargandoJsPDF = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => (window.jspdf && window.jspdf.jsPDF) ? resolve(window.jspdf.jsPDF) : reject(new Error("jsPDF no cargó."));
    s.onerror = () => reject(new Error("No se pudo cargar la librería de PDF."));
    document.head.appendChild(s);
  });
  return cargandoJsPDF;
}

// Genera un UUID sin depender de crypto.randomUUID() (que requiere
// navegadores/iOS recientes). Funciona en cualquier Safari.
function generarUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function filaVacia() {
  return {
    idLocal: idLocal(),
    id: generarUUID(),
    nombre: "",
    categoria: "",
    unidad: "unidad",
    stockNormal: 0,
    stockMedio: 0,
    stockAlto: 0,
    stockBar: 0,
    stockBodega: 0,
    estado: "Activo",
  };
}

// Convierte texto pegado (una línea por producto: nombre,categoria,normal)
// en filas de la tabla. medio y alto se copian del valor normal por defecto,
// se pueden ajustar luego a mano.
function parsearListaPegada(texto) {
  return texto
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0)
    .map((linea) => {
      const partes = linea.split(",").map((p) => p.trim());
      const nombre = partes[0] || "";
      const categoria = partes[1] || "";
      const normal = Number(partes[2]) || 0;
      return {
        idLocal: idLocal(),
        id: generarUUID(),
        nombre,
        categoria,
        unidad: "unidad",
        stockNormal: normal,
        stockMedio: Math.round(normal * 1.3),
        stockAlto: Math.round(normal * 1.5),
        stockBar: 0,
        stockBodega: 0,
        estado: "Activo",
      };
    })
    .filter((f) => f.nombre.length > 0);
}

export default function Configuracion() {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [guardado, setGuardado] = useState(false);
  const [textoPegado, setTextoPegado] = useState("");
  const [mostrarPegar, setMostrarPegar] = useState(false);
  const [pctMedio, setPctMedio] = useState(30);
  const [pctAlto, setPctAlto] = useState(100);

  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetch("/api/productos");
        const data = await res.json();
        if (data.status !== "ok") {
          setError(data.message || "No se pudo cargar el catálogo.");
          setFilas([filaVacia()]);
          return;
        }
        if (data.productos.length === 0) {
          setFilas([filaVacia()]);
        } else {
          setFilas(
            data.productos.map((p) => ({
              idLocal: idLocal(),
              id: p.id,
              nombre: p.nombre || "",
              categoria: p.categoria || "",
              unidad: p.unidad || "unidad",
              stockNormal: p.stock_normal ?? 0,
              stockMedio: p.stock_medio ?? 0,
              stockAlto: p.stock_alto ?? 0,
              stockBar: p.stock_bar ?? 0,
              stockBodega: p.stock_bodega ?? 0,
              estado: p.estado || "Activo",
            }))
          );
        }
      } catch (err) {
        setError("No se pudo conectar con el servidor. " + err.message);
        setFilas([filaVacia()]);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  function actualizarFila(idLocalFila, campo, valor) {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.idLocal !== idLocalFila) return f;
        const actualizada = { ...f, [campo]: valor };
        // Al escribir Normal, recalcula Medio (+30%) y Alto (+50%) automáticamente.
        // Sigue siendo editable a mano después: solo se recalcula cuando cambia Normal.
        if (campo === "stockNormal") {
          const normal = Number(valor) || 0;
          actualizada.stockMedio = Math.round(normal * (1 + pctMedio / 100));
          actualizada.stockAlto = Math.round(normal * (1 + pctAlto / 100));
        }
        return actualizada;
      })
    );
  }

  function agregarFila() {
    setFilas((prev) => [...prev, filaVacia()]);
  }

  // Recalcula Medio (+30%) y Alto (+50%) para TODAS las filas ya cargadas,
  // basándose en el valor actual de Normal de cada una.
  async function descargarPDF() {
    setError(null);
    try {
      const JsPDF = await asegurarJsPDF();
      const doc = new JsPDF();
      let y = 16;
      doc.setFontSize(16);
      doc.text("Catálogo de productos — La Azotea Ocean Bar", 14, y);
      y += 10;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("Producto", 14, y);
      doc.text("Categoría", 90, y);
      doc.text("Normal", 130, y);
      doc.text("Medio", 155, y);
      doc.text("Alto", 178, y);
      doc.setTextColor(0);
      y += 5;

      filas.forEach((f) => {
        if (!f.nombre.trim()) return;
        if (y > 280) {
          doc.addPage();
          y = 16;
        }
        doc.setFontSize(9);
        doc.text(String(f.nombre).slice(0, 40), 14, y);
        doc.text(String(f.categoria || ""), 90, y);
        doc.text(String(f.stockNormal), 130, y);
        doc.text(String(f.stockMedio), 155, y);
        doc.text(String(f.stockAlto), 178, y);
        y += 5;
      });

      doc.save("catalogo-productos.pdf");
    } catch (err) {
      setError("No se pudo generar el PDF. " + err.message);
    }
  }

  function recalcularTodo() {
    setFilas((prev) =>
      prev.map((f) => {
        const normal = Number(f.stockNormal) || 0;
        return {
          ...f,
          stockMedio: Math.round(normal * (1 + pctMedio / 100)),
          stockAlto: Math.round(normal * (1 + pctAlto / 100)),
        };
      })
    );
  }

  function cargarListaPegada() {
    const nuevas = parsearListaPegada(textoPegado);
    if (nuevas.length === 0) {
      setError("No se detectó ningún producto en el texto pegado.");
      return;
    }
    setError(null);
    setFilas((prev) => {
      // Si la tabla solo tenía la fila vacía inicial, la reemplaza.
      const soloVacia = prev.length === 1 && prev[0].nombre.trim() === "";
      return soloVacia ? nuevas : [...prev, ...nuevas];
    });
    setTextoPegado("");
    setMostrarPegar(false);
  }

  function quitarFila(idLocalFila) {
    setFilas((prev) => prev.filter((f) => f.idLocal !== idLocalFila));
  }

  async function guardarTodo() {
    setGuardando(true);
    setError(null);
    setGuardado(false);
    try {
      const productos = filas
        .filter((f) => f.nombre.trim().length > 0)
        .map((f) => ({
          id: f.id && f.id.length > 0 ? f.id : generarUUID(),
          nombre: f.nombre.trim(),
          categoria: f.categoria,
          unidad: f.unidad,
          stockNormal: Number(f.stockNormal) || 0,
          stockMedio: Number(f.stockMedio) || 0,
          stockAlto: Number(f.stockAlto) || 0,
          stockBar: Number(f.stockBar) || 0,
          stockBodega: Number(f.stockBodega) || 0,
          estado: f.estado,
        }));

      if (productos.length === 0) {
        setError("Agrega al menos un producto con nombre.");
        return;
      }

      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productos }),
      });
      const data = await res.json();
      if (data.status !== "ok") {
        setError(data.message || "No se pudo guardar.");
        return;
      }
      setGuardado(true);
      // Recargar con los IDs reales que asignó Supabase
      setFilas(
        data.productos.map((p) => ({
          idLocal: idLocal(),
          id: p.id,
          nombre: p.nombre || "",
          categoria: p.categoria || "",
          unidad: p.unidad || "unidad",
          stockNormal: p.stock_normal ?? 0,
          stockMedio: p.stock_medio ?? 0,
          stockAlto: p.stock_alto ?? 0,
          stockBar: p.stock_bar ?? 0,
          stockBodega: p.stock_bodega ?? 0,
          estado: p.estado || "Activo",
        }))
      );
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
  };

  const inputStyle = {
    width: "100%",
    padding: "8px",
    borderRadius: "6px",
    border: `1px solid ${colores.borde}`,
    background: "#0B1420",
    color: colores.texto,
    fontSize: "14px",
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
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ marginBottom: "24px" }}>
          <Link
            href="/"
            style={{ color: colores.textoSecundario, textDecoration: "none", fontSize: "14px" }}
          >
            ← Inicio
          </Link>
        </div>

        <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>
          Configurar bases
        </h1>
        <p style={{ color: colores.textoSecundario, marginBottom: "24px" }}>
          Carga tus productos y define las cantidades objetivo para cada nivel de
          temporada.
        </p>

        {cargando ? (
          <p style={{ color: colores.textoSecundario }}>Cargando catálogo...</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
              <button
                onClick={() => setMostrarPegar((v) => !v)}
                style={{
                  background: "none",
                  border: `1px solid ${colores.acento}`,
                  borderRadius: "10px",
                  padding: "10px 16px",
                  color: colores.acento,
                  cursor: "pointer",
                }}
              >
                {mostrarPegar ? "Cerrar" : "📋 Pegar lista completa"}
              </button>
              <button
                onClick={descargarPDF}
                style={{
                  background: "none",
                  border: `1px solid ${colores.dorado}`,
                  borderRadius: "10px",
                  padding: "10px 16px",
                  color: colores.dorado,
                  cursor: "pointer",
                }}
              >
                📄 Descargar PDF del catálogo
              </button>
            </div>

            {mostrarPegar && (
              <div
                style={{
                  background: colores.tarjeta,
                  border: `1px solid ${colores.borde}`,
                  borderRadius: "14px",
                  padding: "16px",
                  marginBottom: "20px",
                }}
              >
                <p style={{ color: colores.textoSecundario, fontSize: "13px", marginBottom: "10px" }}>
                  Una línea por producto: <strong>nombre, categoría, cantidad normal</strong>
                </p>
                <textarea
                  value={textoPegado}
                  onChange={(e) => setTextoPegado(e.target.value)}
                  placeholder={"Ron Zacapa 23 años, Ron, 1\nWhisky Old Parr 750 ml, Whisky, 3"}
                  rows={6}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    border: `1px solid ${colores.borde}`,
                    background: "#0B1420",
                    color: colores.texto,
                    fontFamily: "monospace",
                    fontSize: "13px",
                    marginBottom: "10px",
                  }}
                />
                <button
                  onClick={cargarListaPegada}
                  style={{
                    background: colores.dorado,
                    border: "none",
                    borderRadius: "10px",
                    padding: "10px 16px",
                    color: "#0B1420",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cargar en la tabla
                </button>
              </div>
            )}

            <div style={{ overflowX: "auto", marginBottom: "16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: colores.textoSecundario, fontSize: "13px" }}>
                    <th style={{ padding: "8px", width: "26%" }}>Nombre</th>
                    <th style={{ padding: "8px", width: "16%" }}>Categoría</th>
                    <th style={{ padding: "8px", width: "12%" }}>Unidad</th>
                    <th style={{ padding: "8px", width: "12%" }}>Normal</th>
                    <th style={{ padding: "8px", width: "12%" }}>Medio</th>
                    <th style={{ padding: "8px", width: "12%" }}>Alto</th>
                    <th style={{ padding: "8px", width: "40px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.idLocal} style={{ borderTop: `1px solid ${colores.borde}` }}>
                      <td style={{ padding: "6px" }}>
                        <input
                          style={inputStyle}
                          value={f.nombre}
                          placeholder="Nombre del producto"
                          onChange={(e) => actualizarFila(f.idLocal, "nombre", e.target.value)}
                        />
                      </td>
                      <td style={{ padding: "6px" }}>
                        <input
                          style={inputStyle}
                          value={f.categoria}
                          placeholder="Ej. Ron"
                          onChange={(e) => actualizarFila(f.idLocal, "categoria", e.target.value)}
                        />
                      </td>
                      <td style={{ padding: "6px" }}>
                        <input
                          style={inputStyle}
                          value={f.unidad}
                          onChange={(e) => actualizarFila(f.idLocal, "unidad", e.target.value)}
                        />
                      </td>
                      <td style={{ padding: "6px" }}>
                        <input
                          type="number"
                          style={inputStyle}
                          value={f.stockNormal}
                          onChange={(e) => actualizarFila(f.idLocal, "stockNormal", e.target.value)}
                        />
                      </td>
                      <td style={{ padding: "6px" }}>
                        <input
                          type="number"
                          style={inputStyle}
                          value={f.stockMedio}
                          onChange={(e) => actualizarFila(f.idLocal, "stockMedio", e.target.value)}
                        />
                      </td>
                      <td style={{ padding: "6px" }}>
                        <input
                          type="number"
                          style={inputStyle}
                          value={f.stockAlto}
                          onChange={(e) => actualizarFila(f.idLocal, "stockAlto", e.target.value)}
                        />
                      </td>
                      <td style={{ padding: "6px", textAlign: "center" }}>
                        <button
                          onClick={() => quitarFila(f.idLocal)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#F87171",
                            fontSize: "18px",
                            cursor: "pointer",
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-end",
                flexWrap: "wrap",
                marginBottom: "16px",
                background: colores.tarjeta,
                border: `1px solid ${colores.borde}`,
                borderRadius: "12px",
                padding: "14px",
              }}
            >
              <label style={{ fontSize: "13px", color: colores.textoSecundario }}>
                % Medio sobre Normal
                <input
                  type="number"
                  value={pctMedio}
                  onChange={(e) => setPctMedio(Number(e.target.value) || 0)}
                  style={{
                    display: "block",
                    width: "90px",
                    marginTop: "4px",
                    padding: "8px",
                    borderRadius: "6px",
                    border: `1px solid ${colores.borde}`,
                    background: "#0B1420",
                    color: colores.texto,
                  }}
                />
              </label>
              <label style={{ fontSize: "13px", color: colores.textoSecundario }}>
                % Alto sobre Normal
                <input
                  type="number"
                  value={pctAlto}
                  onChange={(e) => setPctAlto(Number(e.target.value) || 0)}
                  style={{
                    display: "block",
                    width: "90px",
                    marginTop: "4px",
                    padding: "8px",
                    borderRadius: "6px",
                    border: `1px solid ${colores.borde}`,
                    background: "#0B1420",
                    color: colores.texto,
                  }}
                />
              </label>
              <button
                onClick={recalcularTodo}
                style={{
                  background: "none",
                  border: `1px solid ${colores.acento}`,
                  borderRadius: "10px",
                  padding: "10px 16px",
                  color: colores.acento,
                  cursor: "pointer",
                }}
              >
                ↻ Recalcular Medio/Alto con estos %
              </button>
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap" }}>
              <button
                onClick={agregarFila}
                style={{
                  background: "none",
                  border: `1px dashed ${colores.borde}`,
                  borderRadius: "10px",
                  padding: "10px 16px",
                  color: colores.textoSecundario,
                  cursor: "pointer",
                }}
              >
                + Agregar producto
              </button>
            </div>

            {error && <p style={{ color: "#F87171", marginBottom: "16px" }}>{error}</p>}
            {guardado && (
              <p style={{ color: colores.acento, marginBottom: "16px", fontWeight: 700 }}>
                ✓ Catálogo guardado correctamente.
              </p>
            )}

            <button
              onClick={guardarTodo}
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
              {guardando ? "Guardando..." : "Guardar catálogo"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
