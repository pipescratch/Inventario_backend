"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

function generarUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function proveedorVacio() {
  return {
    id: generarUUID(),
    nombre: "",
    telefono: "",
    contacto: "",
    observaciones: "",
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [nuevoProductoId, setNuevoProductoId] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState("");
  const [editandoPrecioId, setEditandoPrecioId] = useState(null);
  const [precioEditado, setPrecioEditado] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [resProv, resProd, resPrecios] = await Promise.all([
        fetch("/api/tabla/proveedores"),
        fetch("/api/productos"),
        fetch("/api/tabla/precios_proveedor"),
      ]);
      const dataProv = await resProv.json();
      const dataProd = await resProd.json();
      const dataPrecios = await resPrecios.json();
      if (dataProv.status !== "ok") {
        setError(dataProv.message || "No se pudo cargar los proveedores.");
        return;
      }
      setProveedores(dataProv.filas);
      setProductos(dataProd.status === "ok" ? dataProd.productos : []);
      setPrecios(dataPrecios.status === "ok" ? dataPrecios.filas : []);
    } catch (err) {
      setError("No se pudo conectar con el servidor. " + err.message);
    } finally {
      setCargando(false);
    }
  }

  function preciosDelProveedor(provId) {
    const entries = precios.filter((p) => p.proveedor_id === provId);
    const porProducto = {};
    entries.forEach((e) => {
      if (!porProducto[e.producto_id] || e.fecha >= porProducto[e.producto_id].fecha) {
        porProducto[e.producto_id] = e;
      }
    });
    return Object.values(porProducto)
      .map((e) => ({
        ...e,
        productoNombre: productos.find((p) => p.id === e.producto_id)?.nombre || "Producto eliminado",
      }))
      .sort((a, b) => a.productoNombre.localeCompare(b.productoNombre));
  }

  async function agregarPrecio(provId, provNombre) {
    if (!nuevoProductoId || !nuevoPrecio || Number(nuevoPrecio) <= 0) return;
    const nuevo = {
      id: generarUUID(),
      producto_id: nuevoProductoId,
      proveedor_id: provId,
      proveedor_nombre: provNombre,
      precio: Number(nuevoPrecio),
      fecha: today(),
    };
    setPrecios((prev) => [...prev, nuevo]);
    setNuevoProductoId("");
    setNuevoPrecio("");
    await fetch("/api/tabla/precios_proveedor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filas: [nuevo] }),
    });
  }

  function empezarEdicionPrecio(pr) {
    setEditandoPrecioId(pr.id);
    setPrecioEditado(String(pr.precio));
  }

  async function guardarPrecioEditado(pr) {
    if (!precioEditado || Number(precioEditado) <= 0) return;
    const actualizado = { ...pr, precio: Number(precioEditado), fecha: today() };
    setPrecios((prev) => prev.map((x) => (x.id === pr.id ? actualizado : x)));
    setEditandoPrecioId(null);
    await fetch("/api/tabla/precios_proveedor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filas: [actualizado] }),
    });
  }

  async function guardarProveedor() {
    if (!editando.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/tabla/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filas: [editando] }),
      });
      const data = await res.json();
      if (data.status !== "ok") {
        setError(data.message || "No se pudo guardar.");
        return;
      }
      setEditando(null);
      cargar();
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
    padding: "10px",
    borderRadius: "8px",
    border: `1px solid ${colores.borde}`,
    background: "#0B1420",
    color: colores.texto,
    fontSize: "14px",
    marginTop: "4px",
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
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <Link href="/" style={{ color: colores.textoSecundario, textDecoration: "none" }}>
              Inicio
            </Link>
            <span style={{ color: colores.textoSecundario, opacity: 0.5 }}>/</span>
            <span style={{ color: colores.texto, fontWeight: 600 }}>Proveedores</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700 }}>Proveedores</h1>
          {!editando && (
            <button
              onClick={() => setEditando(proveedorVacio())}
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
              + Nuevo
            </button>
          )}
        </div>

        {error && <p style={{ color: "#F87171", marginBottom: "16px" }}>{error}</p>}

        {editando && (
          <div
            style={{
              background: colores.tarjeta,
              border: `1px solid ${colores.borde}`,
              borderRadius: "14px",
              padding: "20px",
              marginBottom: "24px",
            }}
          >
            <label style={{ display: "block", fontSize: "13px", color: colores.textoSecundario, marginBottom: "12px" }}>
              Nombre
              <input
                style={inputStyle}
                value={editando.nombre}
                onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
              />
            </label>
            <label style={{ display: "block", fontSize: "13px", color: colores.textoSecundario, marginBottom: "12px" }}>
              Teléfono
              <input
                style={inputStyle}
                value={editando.telefono || ""}
                onChange={(e) => setEditando({ ...editando, telefono: e.target.value })}
              />
            </label>
            <label style={{ display: "block", fontSize: "13px", color: colores.textoSecundario, marginBottom: "12px" }}>
              Contacto
              <input
                style={inputStyle}
                value={editando.contacto || ""}
                onChange={(e) => setEditando({ ...editando, contacto: e.target.value })}
              />
            </label>
            <label style={{ display: "block", fontSize: "13px", color: colores.textoSecundario, marginBottom: "16px" }}>
              Observaciones
              <input
                style={inputStyle}
                value={editando.observaciones || ""}
                onChange={(e) => setEditando({ ...editando, observaciones: e.target.value })}
              />
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setEditando(null);
                  setError(null);
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: `1px solid ${colores.borde}`,
                  background: "none",
                  color: colores.textoSecundario,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={guardarProveedor}
                disabled={guardando}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: guardando ? colores.borde : colores.dorado,
                  color: "#0B1420",
                  fontWeight: 700,
                  cursor: guardando ? "default" : "pointer",
                }}
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        )}

        {cargando ? (
          <p style={{ color: colores.textoSecundario }}>Cargando...</p>
        ) : proveedores.length === 0 ? (
          <p style={{ color: colores.textoSecundario }}>
            Todavía no tienes proveedores registrados.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {proveedores.map((p) => {
              const abierto = expandido === p.id;
              const preciosP = preciosDelProveedor(p.id);
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button
                      onClick={() => setExpandido(abierto ? null : p.id)}
                      style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", flex: 1 }}
                    >
                      <div style={{ fontWeight: 700, color: colores.texto }}>{p.nombre}</div>
                      <div style={{ color: colores.textoSecundario, fontSize: "13px" }}>
                        {preciosP.length} producto{preciosP.length === 1 ? "" : "s"} con precio
                        {p.telefono ? ` · ${p.telefono}` : ""}
                      </div>
                    </button>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => setExpandido(abierto ? null : p.id)}
                        style={{ background: "none", border: `1px solid ${colores.borde}`, borderRadius: "8px", padding: "8px 12px", color: colores.acento, cursor: "pointer", fontSize: "13px" }}
                      >
                        {abierto ? "Cerrar" : "Precios"}
                      </button>
                      <button
                        onClick={() => setEditando(p)}
                        style={{ background: "none", border: `1px solid ${colores.borde}`, borderRadius: "8px", padding: "8px 12px", color: colores.textoSecundario, cursor: "pointer", fontSize: "13px" }}
                      >
                        Editar
                      </button>
                    </div>
                  </div>

                  {abierto && (
                    <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${colores.borde}` }}>
                      {preciosP.length === 0 ? (
                        <p style={{ color: "#5B7085", fontSize: "13px", marginBottom: "12px" }}>
                          Sin productos con precio todavía.
                        </p>
                      ) : (
                        <div style={{ display: "grid", gap: "6px", marginBottom: "12px" }}>
                          {preciosP.map((pr) => (
                            <div
                              key={pr.producto_id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: "13px",
                                padding: "6px 0",
                                borderBottom: `1px solid ${colores.borde}`,
                                gap: "8px",
                              }}
                            >
                              <span style={{ flex: 1 }}>{pr.productoNombre}</span>
                              {editandoPrecioId === pr.id ? (
                                <>
                                  <input
                                    type="number"
                                    value={precioEditado}
                                    onChange={(e) => setPrecioEditado(e.target.value)}
                                    style={{ width: "90px", padding: "6px", borderRadius: "6px", border: `1px solid ${colores.acento}`, background: "#0B1420", color: colores.texto, fontSize: "13px" }}
                                  />
                                  <button
                                    onClick={() => guardarPrecioEditado(pr)}
                                    style={{ background: colores.acento, border: "none", borderRadius: "6px", padding: "6px 10px", color: "#0B1420", fontWeight: 700, cursor: "pointer", fontSize: "12px" }}
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    onClick={() => setEditandoPrecioId(null)}
                                    style={{ background: "none", border: `1px solid ${colores.borde}`, borderRadius: "6px", padding: "6px 10px", color: colores.textoSecundario, cursor: "pointer", fontSize: "12px" }}
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span style={{ color: colores.dorado, fontWeight: 700 }}>
                                    ${Math.round(pr.precio).toLocaleString("es-CO")}
                                  </span>
                                  <button
                                    onClick={() => empezarEdicionPrecio(pr)}
                                    style={{ background: "none", border: `1px solid ${colores.acento}`, borderRadius: "6px", padding: "6px 10px", color: colores.acento, cursor: "pointer", fontSize: "12px" }}
                                  >
                                    Editar
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <select
                          value={nuevoProductoId}
                          onChange={(e) => setNuevoProductoId(e.target.value)}
                          style={{ flex: "1 1 160px", padding: "8px", borderRadius: "6px", border: `1px solid ${colores.borde}`, background: "#0B1420", color: colores.texto, fontSize: "13px" }}
                        >
                          <option value="">Producto...</option>
                          {productos.map((prod) => (
                            <option key={prod.id} value={prod.id}>
                              {prod.nombre}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Precio"
                          value={nuevoPrecio}
                          onChange={(e) => setNuevoPrecio(e.target.value)}
                          style={{ width: "100px", padding: "8px", borderRadius: "6px", border: `1px solid ${colores.borde}`, background: "#0B1420", color: colores.texto, fontSize: "13px" }}
                        />
                        <button
                          onClick={() => agregarPrecio(p.id, p.nombre)}
                          style={{ background: colores.dorado, border: "none", borderRadius: "6px", padding: "8px 14px", color: "#0B1420", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}
                        >
                          + Agregar
                        </button>
                      </div>
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
