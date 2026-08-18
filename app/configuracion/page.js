"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

let contadorLocal = 0;
function idLocal() {
  contadorLocal += 1;
  return `local-${contadorLocal}`;
}

function filaVacia() {
  return {
    idLocal: idLocal(),
    id: undefined,
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
        id: undefined,
        nombre,
        categoria,
        unidad: "unidad",
        stockNormal: normal,
        stockMedio: normal,
        stockAlto: normal,
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
      prev.map((f) => (f.idLocal === idLocalFila ? { ...f, [campo]: valor } : f))
    );
  }

  function agregarFila() {
    setFilas((prev) => [...prev, filaVacia()]);
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
          id: f.id,
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
            <button
              onClick={() => setMostrarPegar((v) => !v)}
              style={{
                background: "none",
                border: `1px solid ${colores.acento}`,
                borderRadius: "10px",
                padding: "10px 16px",
                color: colores.acento,
                cursor: "pointer",
                marginBottom: "16px",
              }}
            >
              {mostrarPegar ? "Cerrar" : "📋 Pegar lista completa"}
            </button>

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

            <button
              onClick={agregarFila}
              style={{
                background: "none",
                border: `1px dashed ${colores.borde}`,
                borderRadius: "10px",
                padding: "10px 16px",
                color: colores.textoSecundario,
                cursor: "pointer",
                marginBottom: "24px",
              }}
            >
              + Agregar producto
            </button>

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
