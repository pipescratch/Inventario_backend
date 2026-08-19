"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// El campo "items" de un pedido puede venir en dos formas:
// - Array plano (pedidos antiguos de prueba)
// - { ubicacion, lineas: [...] } (formato actual)
// Estas funciones normalizan cualquiera de las dos.
function lineasDe(items) {
  if (Array.isArray(items)) return items;
  if (items && Array.isArray(items.lineas)) return items.lineas;
  return [];
}
function ubicacionDe(items) {
  if (items && !Array.isArray(items) && items.ubicacion) return items.ubicacion;
  return null;
}

function agruparPorProveedor(lineas) {
  const grupos = {};
  lineas.forEach((it) => {
    const nombre = it.proveedor || "Sin proveedor";
    if (!grupos[nombre]) grupos[nombre] = { proveedorNombre: nombre, items: [], total: 0 };
    grupos[nombre].items.push(it);
    grupos[nombre].total += Number(it.total) || 0;
  });
  return Object.values(grupos);
}

function textoWhatsApp(grupo) {
  const lineas = grupo.items.map(
    (it) => `• ${it.nombre} — ${it.cantidad} un. — $${Math.round(it.total).toLocaleString("es-CO")}`
  );
  return `Pedido para ${grupo.proveedorNombre}\n\n${lineas.join("\n")}\n\nTotal: $${Math.round(grupo.total).toLocaleString("es-CO")}`;
}

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

export default function Historial() {
  const [vista, setVista] = useState("pedidos"); // pedidos | inventarios
  const [pedidos, setPedidos] = useState([]);
  const [inventarios, setInventarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [lineasEdicion, setLineasEdicion] = useState([]);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [copiado, setCopiado] = useState(null);
  const [recibiendoId, setRecibiendoId] = useState(null);
  const [lineasRecepcion, setLineasRecepcion] = useState([]);

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

  // Marca un pedido pendiente como comprado: suma lo pedido al stock del
  // producto (en la ubicación con la que se hizo ese pedido) y cambia el
  // estado del pedido a "confirmado".
  function empezarRecepcion(pedido) {
    setRecibiendoId(pedido.id);
    setLineasRecepcion(
      lineasDe(pedido.items).map((l) => ({ ...l, recibido: l.recibido !== false, nota: l.nota || "" }))
    );
  }

  function alternarRecibido(index) {
    setLineasRecepcion((prev) =>
      prev.map((l, i) => (i === index ? { ...l, recibido: !l.recibido } : l))
    );
  }

  function actualizarNota(index, nota) {
    setLineasRecepcion((prev) => prev.map((l, i) => (i === index ? { ...l, nota } : l)));
  }

  async function confirmarRecepcion(pedido) {
    setConfirmandoId(pedido.id);
    setError(null);
    try {
      const ubicacion = ubicacionDe(pedido.items) || "bar";
      const stockCampo = ubicacion === "bar" ? "stock_bar" : "stock_bodega";

      const resProd = await fetch("/api/productos");
      const dataProd = await resProd.json();
      if (dataProd.status !== "ok") {
        setError("No se pudo cargar el catálogo para actualizar el stock.");
        return;
      }
      const catalogo = dataProd.productos;

      // Solo se suma al stock lo que realmente llegó. Lo marcado como
      // faltante queda anotado en el pedido, sin sumarse al inventario.
      const productosActualizados = lineasRecepcion
        .filter((it) => it.productoId && it.recibido)
        .map((it) => {
          const original = catalogo.find((p) => p.id === it.productoId);
          if (!original) return null;
          const stockActual = Number(original[stockCampo]) || 0;
          return {
            id: original.id,
            nombre: original.nombre,
            categoria: original.categoria,
            unidad: original.unidad,
            stockNormal: original.stock_normal,
            stockMedio: original.stock_medio,
            stockAlto: original.stock_alto,
            stockBar: stockCampo === "stock_bar" ? stockActual + it.cantidad : original.stock_bar,
            stockBodega: stockCampo === "stock_bodega" ? stockActual + it.cantidad : original.stock_bodega,
            estado: original.estado,
          };
        })
        .filter(Boolean);

      if (productosActualizados.length > 0) {
        await fetch("/api/productos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productos: productosActualizados }),
        });
      }

      await fetch("/api/tabla/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filas: [{ ...pedido, estado: "confirmado", items: { ubicacion, lineas: lineasRecepcion } }],
        }),
      });

      setRecibiendoId(null);
      await cargar();
    } catch (err) {
      setError("No se pudo confirmar la recepción. " + err.message);
    } finally {
      setConfirmandoId(null);
    }
  }

  function empezarEdicion(pedido) {
    setEditandoId(pedido.id);
    setLineasEdicion(lineasDe(pedido.items).map((l) => ({ ...l })));
  }

  function actualizarCantidadEdicion(index, cantidad) {
    setLineasEdicion((prev) =>
      prev.map((l, i) =>
        i === index
          ? { ...l, cantidad, total: Math.round((Number(l.precio) || 0) * (Number(cantidad) || 0) * 100) / 100 }
          : l
      )
    );
  }

  function quitarLineaEdicion(index) {
    setLineasEdicion((prev) => prev.filter((_, i) => i !== index));
  }

  async function guardarEdicion(pedido) {
    setGuardandoEdicion(true);
    setError(null);
    try {
      const ubicacion = ubicacionDe(pedido.items) || "bar";
      const costoTotal = lineasEdicion.reduce((s, l) => s + (Number(l.total) || 0), 0);
      await fetch("/api/tabla/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filas: [
            {
              ...pedido,
              items: { ubicacion, lineas: lineasEdicion },
              costo_total: costoTotal,
            },
          ],
        }),
      });
      setEditandoId(null);
      await cargar();
    } catch (err) {
      setError("No se pudo guardar la edición. " + err.message);
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function eliminarPedido(id) {
    const confirmar = window.confirm("¿Seguro que quieres borrar este pedido? No se puede deshacer.");
    if (!confirmar) return;
    setEliminandoId(id);
    setError(null);
    try {
      await fetch(`/api/tabla/pedidos?id=${id}`, { method: "DELETE" });
      await cargar();
    } catch (err) {
      setError("No se pudo borrar. " + err.message);
    } finally {
      setEliminandoId(null);
    }
  }

  async function copiarWhatsApp(grupo, pedidoId) {
    try {
      await navigator.clipboard.writeText(textoWhatsApp(grupo));
      setCopiado(pedidoId + grupo.proveedorNombre);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona y copia el texto manualmente.");
    }
  }

  async function descargarPDF(pedido) {
    setError(null);
    try {
      const JsPDF = await asegurarJsPDF();
      const doc = new JsPDF();
      let y = 16;
      doc.setFontSize(16);
      doc.text("Pedido — La Azotea Ocean Bar", 14, y);
      y += 7;
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text(`Pedido #${pedido.numero} · ${pedido.fecha} · ${pedido.hora} · Nivel ${pedido.nivel}`, 14, y);
      doc.setTextColor(0);
      y += 10;

      const gruposPdf = agruparPorProveedor(lineasDe(pedido.items));
      let totalGeneral = 0;

      gruposPdf.forEach((grupo) => {
        if (y > 265) {
          doc.addPage();
          y = 16;
        }
        doc.setFontSize(12);
        doc.setFont(undefined, "bold");
        doc.text(`Proveedor: ${grupo.proveedorNombre}`, 14, y);
        doc.setFont(undefined, "normal");
        y += 6;
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text("Producto", 14, y);
        doc.text("Cant.", 130, y);
        doc.text("Total", 170, y);
        doc.setTextColor(0);
        y += 5;
        grupo.items.forEach((it) => {
          if (y > 275) {
            doc.addPage();
            y = 16;
          }
          doc.setFontSize(9);
          doc.text(String(it.nombre).slice(0, 55), 14, y);
          doc.text(String(it.cantidad), 130, y);
          doc.text(`$${Math.round(it.total).toLocaleString("es-CO")}`, 170, y);
          y += 5;
        });
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.text(`Subtotal: $${Math.round(grupo.total).toLocaleString("es-CO")}`, 14, y + 3);
        doc.setFont(undefined, "normal");
        y += 12;
        totalGeneral += grupo.total;
      });

      if (y > 270) {
        doc.addPage();
        y = 16;
      }
      doc.setFontSize(13);
      doc.setFont(undefined, "bold");
      doc.text(`TOTAL GENERAL: $${Math.round(totalGeneral).toLocaleString("es-CO")}`, 14, y + 6);

      doc.save(`pedido-${pedido.numero}-${pedido.fecha}.pdf`);
    } catch (err) {
      setError("No se pudo generar el PDF. " + err.message);
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
            <p style={{ color: colores.textoSecundario }}>Todavía no hay pedidos.</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {pedidos.map((p) => {
                const abierto = expandido === p.id;
                const lineas = lineasDe(p.items);
                const pendiente = p.estado === "pendiente";
                return (
                  <div
                    key={p.id}
                    style={{
                      background: colores.tarjeta,
                      border: `1px solid ${pendiente ? colores.alerta : colores.borde}`,
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
                          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                            Pedido #{p.numero}
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                padding: "2px 8px",
                                borderRadius: "999px",
                                background: pendiente ? `${colores.alerta}22` : `${colores.acento}22`,
                                color: pendiente ? colores.alerta : colores.acento,
                              }}
                            >
                              {pendiente ? "Pendiente" : "Comprado"}
                            </span>
                          </div>
                          <div style={{ color: colores.textoSecundario, fontSize: "13px" }}>
                            {p.fecha} · {p.hora} · Nivel {p.nivel}
                          </div>
                        </div>
                        <span style={{ color: colores.dorado, fontWeight: 700 }}>
                          ${Math.round(p.costo_total || 0).toLocaleString("es-CO")}
                        </span>
                      </div>
                    </button>
                    {abierto && editandoId !== p.id && (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${colores.borde}` }}>
                        {lineas.map((it, i) => (
                          <div key={i} style={{ padding: "4px 0" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "13px",
                                color: it.recibido === false ? "#F87171" : colores.textoSecundario,
                              }}
                            >
                              <span>
                                {it.recibido === false && "⚠️ "}
                                {it.nombre} × {it.cantidad} ({it.proveedor})
                              </span>
                              <span>${Math.round(it.total).toLocaleString("es-CO")}</span>
                            </div>
                            {it.recibido === false && it.nota && (
                              <div style={{ fontSize: "11px", color: "#F87171", marginTop: "2px" }}>
                                Faltante: {it.nota}
                              </div>
                            )}
                          </div>
                        ))}

                        <button
                          onClick={() => descargarPDF(p)}
                          style={{
                            width: "100%",
                            marginTop: "12px",
                            padding: "10px",
                            borderRadius: "8px",
                            border: `1px solid ${colores.dorado}`,
                            background: "none",
                            color: colores.dorado,
                            fontWeight: 700,
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          📄 Descargar PDF completo
                        </button>

                        <div style={{ display: "grid", gap: "6px", marginTop: "8px" }}>
                          {agruparPorProveedor(lineas).map((grupo) => (
                            <button
                              key={grupo.proveedorNombre}
                              onClick={() => copiarWhatsApp(grupo, p.id)}
                              style={{
                                width: "100%",
                                padding: "10px",
                                borderRadius: "8px",
                                border: `1px solid ${colores.acento}`,
                                background: copiado === p.id + grupo.proveedorNombre ? colores.acento : "none",
                                color: copiado === p.id + grupo.proveedorNombre ? "#0B1420" : colores.acento,
                                fontWeight: 700,
                                fontSize: "13px",
                                cursor: "pointer",
                              }}
                            >
                              {copiado === p.id + grupo.proveedorNombre
                                ? "✓ Copiado"
                                : `WhatsApp — ${grupo.proveedorNombre}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {editandoId === p.id && (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${colores.borde}` }}>
                        {lineasEdicion.map((it, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                            <span style={{ flex: 1, fontSize: "13px" }}>{it.nombre}</span>
                            <input
                              type="number"
                              value={it.cantidad}
                              onChange={(e) => actualizarCantidadEdicion(i, Number(e.target.value))}
                              style={{
                                width: "70px",
                                padding: "6px",
                                borderRadius: "6px",
                                border: `1px solid ${colores.borde}`,
                                background: "#0B1420",
                                color: colores.texto,
                                fontSize: "13px",
                              }}
                            />
                            <button
                              onClick={() => quitarLineaEdicion(i)}
                              style={{ background: "none", border: "none", color: "#F87171", cursor: "pointer", fontSize: "16px" }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                          <button
                            onClick={() => setEditandoId(null)}
                            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${colores.borde}`, background: "none", color: colores.textoSecundario, cursor: "pointer" }}
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => guardarEdicion(p)}
                            disabled={guardandoEdicion}
                            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: colores.acento, color: "#0B1420", fontWeight: 700, cursor: "pointer" }}
                          >
                            {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
                          </button>
                        </div>
                      </div>
                    )}

                    {recibiendoId === p.id && (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${colores.borde}` }}>
                        <p style={{ color: colores.textoSecundario, fontSize: "13px", marginBottom: "10px" }}>
                          Marca qué llegó realmente. Lo que no llegue no se suma al inventario.
                        </p>
                        {lineasRecepcion.map((it, i) => (
                          <div
                            key={i}
                            style={{
                              background: it.recibido ? "transparent" : "rgba(248,113,113,0.08)",
                              borderRadius: "8px",
                              padding: "8px",
                              marginBottom: "8px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <input
                                type="checkbox"
                                checked={it.recibido}
                                onChange={() => alternarRecibido(i)}
                                style={{ width: "18px", height: "18px" }}
                              />
                              <span style={{ flex: 1, fontSize: "13px" }}>
                                {it.nombre} × {it.cantidad}
                              </span>
                              {!it.recibido && <span style={{ fontSize: "16px" }}>⚠️</span>}
                            </div>
                            {!it.recibido && (
                              <input
                                value={it.nota}
                                onChange={(e) => actualizarNota(i, e.target.value)}
                                placeholder="Nota: ¿por qué falta? (ej. agotado con el proveedor)"
                                style={{
                                  width: "100%",
                                  marginTop: "6px",
                                  padding: "8px",
                                  borderRadius: "6px",
                                  border: `1px solid ${colores.alerta}`,
                                  background: "#0B1420",
                                  color: colores.texto,
                                  fontSize: "12px",
                                }}
                              />
                            )}
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                          <button
                            onClick={() => setRecibiendoId(null)}
                            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${colores.borde}`, background: "none", color: colores.textoSecundario, cursor: "pointer" }}
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => confirmarRecepcion(p)}
                            disabled={confirmandoId === p.id}
                            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: colores.dorado, color: "#0B1420", fontWeight: 700, cursor: "pointer" }}
                          >
                            {confirmandoId === p.id ? "Guardando..." : "✓ Confirmar recepción"}
                          </button>
                        </div>
                      </div>
                    )}

                    {pendiente && editandoId !== p.id && recibiendoId !== p.id && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                        <button
                          onClick={() => empezarRecepcion(p)}
                          style={{
                            flex: "1 1 140px",
                            padding: "12px",
                            borderRadius: "10px",
                            border: "none",
                            background: colores.dorado,
                            color: "#0B1420",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          ✓ Comprado
                        </button>
                        <button
                          onClick={() => empezarEdicion(p)}
                          style={{
                            flex: "1 1 100px",
                            padding: "12px",
                            borderRadius: "10px",
                            border: `1px solid ${colores.acento}`,
                            background: "none",
                            color: colores.acento,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarPedido(p.id)}
                          disabled={eliminandoId === p.id}
                          style={{
                            flex: "1 1 100px",
                            padding: "12px",
                            borderRadius: "10px",
                            border: "1px solid #F87171",
                            background: "none",
                            color: "#F87171",
                            fontWeight: 700,
                            cursor: eliminandoId === p.id ? "default" : "pointer",
                          }}
                        >
                          {eliminandoId === p.id ? "Borrando..." : "Borrar"}
                        </button>
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

