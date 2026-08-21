"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const TRAGOS_POR_BOTELLA = 12;
const ESTACION_FIJA = "barra";

function generarUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

function esBotella(producto) {
  return (producto.unidad || "").toLowerCase().trim() === "botella";
}

function closedStock(p) {
  return (Number(p.stock_bar) || 0) + (Number(p.stock_bodega) || 0);
}
function objetivo(p, nivel) {
  const campo = nivel === "normal" ? "stock_normal" : nivel === "medio" ? "stock_medio" : "stock_alto";
  return Number(p[campo]) || 0;
}
function calcularEstado(p, nivel) {
  const obj = objetivo(p, nivel);
  const c = closedStock(p);
  if (obj <= 0) return "COMPLETO";
  if (c <= obj * 0.5) return "CRITICO";
  if (c < obj) return "BAJO";
  if (c === obj) return "NORMAL";
  return "COMPLETO";
}

const ESTADO_ESTILO = {
  CRITICO: { label: "Crítico", color: "#E2574C" },
  BAJO: { label: "Bajo", color: "#E0913F" },
  NORMAL: { label: "En objetivo", color: "#D9B84A" },
  COMPLETO: { label: "Completo", color: "#4FAE84" },
};

function BarraAbierta({ tragos }) {
  const t = Math.max(0, Math.min(TRAGOS_POR_BOTELLA, Number(tragos) || 0));
  const pct = t / TRAGOS_POR_BOTELLA;
  const color = pct >= 0.6 ? "#4FAE84" : pct >= 0.3 ? "#E0913F" : "#E2574C";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      <span style={{ display: "inline-flex", alignItems: "flex-end", gap: "2px" }}>
        {Array.from({ length: TRAGOS_POR_BOTELLA }).map((_, i) => (
          <span
            key={i}
            style={{
              width: "4px",
              height: 6 + (i % 2 === 0 ? 3 : 0),
              borderRadius: "1px",
              background: i < t ? color : "transparent",
              border: i < t ? "none" : "1px solid #2C4258",
            }}
          />
        ))}
      </span>
      <span style={{ color, fontSize: "12px", fontWeight: 700 }}>
        {t}/{TRAGOS_POR_BOTELLA}
      </span>
    </span>
  );
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

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [botellas, setBotellas] = useState([]);
  const [nivel, setNivel] = useState("normal");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  async function descargarPDF() {
    setError(null);
    try {
      const JsPDF = await asegurarJsPDF();
      const doc = new JsPDF();
      let y = 16;
      doc.setFontSize(16);
      doc.text("Inventario — La Azotea Ocean Bar", 14, y);
      y += 7;
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text(`${today()} · ${nowTime()} · Nivel ${nivel}`, 14, y);
      doc.setTextColor(0);
      y += 10;

      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("Producto", 14, y);
      doc.text("Bar+Bodega", 110, y);
      doc.text("Objetivo", 145, y);
      doc.text("Estado", 175, y);
      doc.setTextColor(0);
      y += 5;

      const filtrados = productos
        .filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
        .sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "") || a.nombre.localeCompare(b.nombre));

      filtrados.forEach((p) => {
        if (y > 280) {
          doc.addPage();
          y = 16;
        }
        const estado = calcularEstado(p, nivel);
        doc.setFontSize(9);
        doc.text(String(p.nombre).slice(0, 55), 14, y);
        doc.text(String(closedStock(p)), 118, y);
        doc.text(String(objetivo(p, nivel)), 150, y);
        doc.text(ESTADO_ESTILO[estado].label, 175, y);
        y += 5;
      });

      doc.save(`inventario-${today()}.pdf`);
    } catch (err) {
      setError("No se pudo generar el PDF. " + err.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [resProd, resBot] = await Promise.all([
        fetch("/api/productos"),
        fetch("/api/tabla/botellas_trabajo"),
      ]);
      const dataProd = await resProd.json();
      const dataBot = await resBot.json();
      if (dataProd.status !== "ok") {
        setError(dataProd.message || "No se pudo cargar productos.");
        return;
      }
      setProductos(dataProd.productos);
      setBotellas(dataBot.status === "ok" ? dataBot.filas : []);
    } catch (err) {
      setError("No se pudo conectar con el servidor. " + err.message);
    } finally {
      setCargando(false);
    }
  }

  // Restablece el stock de Barra al valor base (nivel Normal) para todos
  // los productos — deja el inventario como estaba el día que cargaste la
  // base, para poder hacer una prueba limpia y comparable de un conteo nuevo.
  async function restablecerABase() {
    const confirmar = window.confirm(
      "Esto va a reemplazar el stock actual de Barra de TODOS los productos por su valor base (Normal), y va a cerrar todas las botellas abiertas actuales. ¿Continuar?"
    );
    if (!confirmar) return;

    setCargando(true);
    setError(null);
    try {
      const productosActualizados = productos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        unidad: p.unidad,
        stockNormal: p.stock_normal,
        stockMedio: p.stock_medio,
        stockAlto: p.stock_alto,
        stockBar: p.stock_normal,
        stockBodega: 0,
        estado: p.estado,
      }));
      await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productos: productosActualizados }),
      });

      // Al volver a la base, cualquier botella abierta que hubiera queda
      // fuera de contexto: se cierra para que no quede "abierta" de un
      // período anterior.
      const resBot = await fetch("/api/tabla/botellas_trabajo");
      const dataBot = await resBot.json();
      const activas = dataBot.status === "ok" ? dataBot.filas.filter((b) => b.estado === "activa") : [];
      if (activas.length > 0) {
        const cerradas = activas.map((b) => ({
          ...b,
          estado: "terminada",
          cantidad_final: b.tragos,
          fecha_terminacion: today(),
          hora_terminacion: nowTime(),
        }));
        await fetch("/api/tabla/botellas_trabajo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filas: cerradas }),
        });
      }

      await cargar();
    } catch (err) {
      setError("No se pudo restablecer. " + err.message);
    } finally {
      setCargando(false);
    }
  }

  function botellasActivasDe(productoId) {
    return botellas.filter((b) => b.producto_id === productoId && b.estado === "activa");
  }

  // Las botellas abiertas se crean automáticamente al guardar un conteo
  // con fracción abierta detectada (desde "Hacer pedido semanal"), no
  // manualmente desde aquí.

  async function ajustarTragos(botella, delta) {
    const nuevoTragos = Math.max(0, Math.min(TRAGOS_POR_BOTELLA, botella.tragos + delta));
    const actualizada = { ...botella, tragos: nuevoTragos };
    setBotellas((prev) => prev.map((b) => (b.id === botella.id ? actualizada : b)));
    await fetch("/api/tabla/botellas_trabajo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filas: [actualizada] }),
    });
  }

  async function terminarBotella(botella) {
    const actualizada = {
      ...botella,
      estado: "terminada",
      cantidad_final: botella.tragos,
      fecha_terminacion: today(),
      hora_terminacion: nowTime(),
    };
    setBotellas((prev) => prev.map((b) => (b.id === botella.id ? actualizada : b)));
    await fetch("/api/tabla/botellas_trabajo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filas: [actualizada] }),
    });
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

  const productosFiltrados = productos
    .filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "") || a.nombre.localeCompare(b.nombre));

  return (
    <main
      style={{
        background: colores.fondo,
        minHeight: "100vh",
        color: colores.texto,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: "820px", margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <Link href="/" style={{ color: colores.textoSecundario, textDecoration: "none" }}>
              Inicio
            </Link>
            <span style={{ color: colores.textoSecundario, opacity: 0.5 }}>/</span>
            <span style={{ color: colores.texto, fontWeight: 600 }}>Ver inventario</span>
          </div>
        </div>

        <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>Ver inventario</h1>
        <p style={{ color: colores.textoSecundario, marginBottom: "20px" }}>
          Estado actual comparado contra el nivel seleccionado.
        </p>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {[
            { id: "normal", label: "Normal" },
            { id: "medio", label: "Medio" },
            { id: "alto", label: "Alto" },
          ].map((n) => (
            <button
              key={n.id}
              onClick={() => setNivel(n.id)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "10px",
                border: `1px solid ${nivel === n.id ? colores.acento : colores.borde}`,
                background: nivel === n.id ? "rgba(45,212,191,0.1)" : colores.tarjeta,
                color: nivel === n.id ? colores.acento : colores.textoSecundario,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "13px",
              }}
            >
              {n.label}
            </button>
          ))}
        </div>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: `1px solid ${colores.borde}`,
            background: colores.tarjeta,
            color: colores.texto,
            marginBottom: "12px",
          }}
        />

        <button
          onClick={descargarPDF}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "10px",
            border: `1px solid ${colores.dorado}`,
            background: "none",
            color: colores.dorado,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: "10px",
          }}
        >
          📄 Descargar PDF del inventario
        </button>

        <button
          onClick={restablecerABase}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "10px",
            border: "1px solid #F87171",
            background: "none",
            color: "#F87171",
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: "10px",
          }}
        >
          ↺ Restablecer inventario a la base (Normal)
        </button>

        <Link
          href="/botellas-abiertas"
          style={{
            display: "block",
            width: "100%",
            padding: "10px",
            borderRadius: "10px",
            border: `1px solid ${colores.acento}`,
            background: "none",
            color: colores.acento,
            fontWeight: 700,
            textAlign: "center",
            textDecoration: "none",
            marginBottom: "20px",
          }}
        >
          🍾 Ver todas las botellas abiertas
        </Link>

        {error && <p style={{ color: "#F87171", marginBottom: "16px" }}>{error}</p>}

        {cargando ? (
          <p style={{ color: colores.textoSecundario }}>Cargando...</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {productosFiltrados.map((p) => {
              const estado = calcularEstado(p, nivel);
              const estilo = ESTADO_ESTILO[estado];
              const activas = esBotella(p) ? botellasActivasDe(p.id) : [];
              return (
                <div
                  key={p.id}
                  style={{
                    background: colores.tarjeta,
                    border: `1px solid ${colores.borde}`,
                    borderRadius: "14px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                      <div style={{ color: colores.textoSecundario, fontSize: "12px" }}>
                        {p.categoria} · Bar {p.stock_bar} + Bodega {p.stock_bodega} = {closedStock(p)} / objetivo {objetivo(p, nivel)}
                      </div>
                    </div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: `${estilo.color}22`,
                        color: estilo.color,
                        border: `1px solid ${estilo.color}55`,
                        borderRadius: "999px",
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: estilo.color }} />
                      {estilo.label}
                    </span>
                  </div>

                  {esBotella(p) && (
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${colores.borde}` }}>
                      {activas.length === 0 ? (
                        <span style={{ color: "#5B7085", fontSize: "12px" }}>Ninguna botella abierta</span>
                      ) : (
                        <div style={{ display: "grid", gap: "8px", marginBottom: "8px" }}>
                          {activas.map((b) => (
                            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                              <BarraAbierta tragos={b.tragos} />
                              <button
                                onClick={() => ajustarTragos(b, -1)}
                                style={{ background: "none", border: `1px solid ${colores.borde}`, borderRadius: "6px", color: colores.texto, width: "26px", height: "26px", cursor: "pointer" }}
                              >
                                −
                              </button>
                              <button
                                onClick={() => ajustarTragos(b, 1)}
                                style={{ background: "none", border: `1px solid ${colores.borde}`, borderRadius: "6px", color: colores.texto, width: "26px", height: "26px", cursor: "pointer" }}
                              >
                                +
                              </button>
                              <button
                                onClick={() => terminarBotella(b)}
                                style={{ background: "none", border: "none", color: "#F87171", fontSize: "12px", cursor: "pointer" }}
                              >
                                Terminar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
