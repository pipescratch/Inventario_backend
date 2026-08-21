"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const TRAGOS_POR_BOTELLA = 12;

function today() {
  return new Date().toISOString().slice(0, 10);
}
function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

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
              width: "5px",
              height: 8 + (i % 2 === 0 ? 4 : 0),
              borderRadius: "1px",
              background: i < t ? color : "transparent",
              border: i < t ? "none" : "1px solid #2C4258",
            }}
          />
        ))}
      </span>
      <span style={{ color, fontSize: "14px", fontWeight: 700 }}>
        {t}/{TRAGOS_POR_BOTELLA}
      </span>
    </span>
  );
}

export default function BotellasAbiertas() {
  const [botellas, setBotellas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [resBot, resProd] = await Promise.all([
        fetch("/api/tabla/botellas_trabajo"),
        fetch("/api/productos"),
      ]);
      const dataBot = await resBot.json();
      const dataProd = await resProd.json();
      setBotellas(dataBot.status === "ok" ? dataBot.filas.filter((b) => b.estado === "activa") : []);
      setProductos(dataProd.status === "ok" ? dataProd.productos : []);
    } catch (err) {
      setError("No se pudo conectar con el servidor. " + err.message);
    } finally {
      setCargando(false);
    }
  }

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
    setBotellas((prev) => prev.filter((b) => b.id !== botella.id));
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

  // Las más vacías primero: son las más urgentes de reemplazar.
  const botellasConProducto = botellas
    .map((b) => ({ ...b, producto: productos.find((p) => p.id === b.producto_id) }))
    .filter((b) => b.producto)
    .sort((a, b) => a.tragos - b.tragos);

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
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <Link href="/" style={{ color: colores.textoSecundario, textDecoration: "none" }}>
              Inicio
            </Link>
            <span style={{ color: colores.textoSecundario, opacity: 0.5 }}>/</span>
            <span style={{ color: colores.texto, fontWeight: 600 }}>Botellas abiertas</span>
          </div>
        </div>

        <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>Botellas abiertas</h1>
        <p style={{ color: colores.textoSecundario, marginBottom: "24px" }}>
          Todo lo que está abierto en Barra ahora mismo, de más vacío a más lleno.
        </p>

        {error && <p style={{ color: "#F87171", marginBottom: "16px" }}>{error}</p>}

        {cargando ? (
          <p style={{ color: colores.textoSecundario }}>Cargando...</p>
        ) : botellasConProducto.length === 0 ? (
          <p style={{ color: colores.textoSecundario }}>
            No hay ninguna botella abierta registrada en este momento.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {botellasConProducto.map((b) => (
              <div
                key={b.id}
                style={{
                  background: colores.tarjeta,
                  border: `1px solid ${colores.borde}`,
                  borderRadius: "14px",
                  padding: "16px",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>{b.producto.nombre}</div>
                <div style={{ color: colores.textoSecundario, fontSize: "12px", marginBottom: "12px" }}>
                  {b.producto.categoria} · Abierta {b.fecha_apertura}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <BarraAbierta tragos={b.tragos} />
                  <button
                    onClick={() => ajustarTragos(b, -1)}
                    style={{ background: "none", border: `1px solid ${colores.borde}`, borderRadius: "6px", color: colores.texto, width: "30px", height: "30px", cursor: "pointer" }}
                  >
                    −
                  </button>
                  <button
                    onClick={() => ajustarTragos(b, 1)}
                    style={{ background: "none", border: `1px solid ${colores.borde}`, borderRadius: "6px", color: colores.texto, width: "30px", height: "30px", cursor: "pointer" }}
                  >
                    +
                  </button>
                  <button
                    onClick={() => terminarBotella(b)}
                    style={{ background: "none", border: "none", color: "#F87171", fontSize: "13px", cursor: "pointer", marginLeft: "auto" }}
                  >
                    Terminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
