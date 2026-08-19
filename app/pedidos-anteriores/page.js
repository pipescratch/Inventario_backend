"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Historial() {
  const [vista, setVista] = useState("pedidos"); // pedidos | inventarios
  const [pedidos, setPedidos] = useState([]);
  const [inventarios, setInventarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [resPedidos, resInv] = await Promise.all([
        fetch("/api/tabla/pedidos"),
        fetch("/api/tabla/historial_inventarios"),
      ]);
      const dataPedidos = await resPedidos.json();
      const dataInv = await resInv.json();
      if (dataPedidos.status === "ok") {
        setPedidos(dataPedidos.filas.sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)));
      }
      if (dataInv.status === "ok") {
        setInventarios(dataInv.filas.sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)));
      }
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
          <Link href="/" style={{ color: colores.textoSecundario, textDecoration: "none", fontSize: "14px" }}>
            ← Inicio
          </Link>
        </div>

        <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "20px" }}>Historial</h1>

        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          <button
            onClick={() => setVista("pedidos")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "10px",
              border: `1px solid ${vista === "pedidos" ? colores.acento : colores.borde}`,
              background: vista === "pedidos" ? "rgba(45,212,191,0.1)" : colores.tarjeta,
              color: vista === "pedidos" ? colores.acento : colores.textoSecundario,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Pedidos
          </button>
          <button
            onClick={() => setVista("inventarios")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "10px",
              border: `1px solid ${vista === "inventarios" ? colores.acento : colores.borde}`,
              background: vista === "inventarios" ? "rgba(45,212,191,0.1)" : colores.tarjeta,
              color: vista === "inventarios" ? colores.acento : colores.textoSecundario,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Conteos de inventario
          </button>
        </div>

        {error && <p style={{ color: "#F87171", marginBottom: "16px" }}>{error}</p>}

        {cargando ? (
          <p style={{ color: colores.textoSecundario }}>Cargando...</p>
        ) : vista === "pedidos" ? (
          pedidos.length === 0 ? (
            <p style={{ color: colores.textoSecundario }}>Todavía no hay pedidos confirmados.</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {pedidos.map((p) => {
                const abierto = expandido === p.id;
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
                    <button
                      onClick={() => setExpandido(abierto ? null : p.id)}
                      style={{ background: "none", border: "none", width: "100%", textAlign: "left", cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>Pedido #{p.numero}</div>
                          <div style={{ color: colores.textoSecundario, fontSize: "13px" }}>
                            {p.fecha} · {p.hora} · Nivel {p.nivel}
                          </div>
                        </div>
                        <span style={{ color: colores.dorado, fontWeight: 700 }}>
                          ${Math.round(p.costo_total || 0).toLocaleString("es-CO")}
                        </span>
                      </div>
                    </button>
                    {abierto && (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${colores.borde}` }}>
                        {(p.items || []).map((it, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "13px",
                              color: colores.textoSecundario,
                              padding: "4px 0",
                            }}
                          >
                            <span>{it.nombre} × {it.cantidad} ({it.proveedor})</span>
                            <span>${Math.round(it.total).toLocaleString("es-CO")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : inventarios.length === 0 ? (
          <p style={{ color: colores.textoSecundario }}>Todavía no hay conteos guardados.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {inventarios.map((inv) => {
              const abierto = expandido === inv.id;
              return (
                <div
                  key={inv.id}
                  style={{
                    background: colores.tarjeta,
                    border: `1px solid ${colores.borde}`,
                    borderRadius: "14px",
                    padding: "16px",
                  }}
                >
                  <button
                    onClick={() => setExpandido(abierto ? null : inv.id)}
                    style={{ background: "none", border: "none", width: "100%", textAlign: "left", cursor: "pointer" }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {inv.fecha} · {inv.hora}
                    </div>
                    <div style={{ color: colores.textoSecundario, fontSize: "13px" }}>
                      Nivel {inv.nivel} · {inv.ubicacion} · {(inv.items || []).length} productos
                    </div>
                  </button>
                  {abierto && (
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${colores.borde}` }}>
                      {(inv.items || []).map((it, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "13px",
                            color: colores.textoSecundario,
                            padding: "4px 0",
                          }}
                        >
                          <span>{it.rawName}</span>
                          <span>{it.cantidadDetectada}</span>
                        </div>
                      ))}
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
