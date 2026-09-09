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
            if (blob) resolve(blob);
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

function normalizarTexto(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
  const [editandoMasivoId, setEditandoMasivoId] = useState(null);
  const [preciosMasivos, setPreciosMasivos] = useState({});
  const [cargaPreciosProveedor, setCargaPreciosProveedor] = useState(null);
  const [archivosCarga, setArchivosCarga] = useState([]);
  const [pasoCarga, setPasoCarga] = useState("subir");
  const [cargandoCarga, setCargandoCarga] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);
  const [itemsCarga, setItemsCarga] = useState([]);

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

  function empezarEdicionMasiva(provId, listaPrecios) {
    const valores = {};
    listaPrecios.forEach((pr) => {
      valores[pr.id] = String(pr.precio);
    });
    setPreciosMasivos(valores);
    setEditandoMasivoId(provId);
  }

  function cancelarEdicionMasiva() {
    setEditandoMasivoId(null);
    setPreciosMasivos({});
  }

  async function guardarPreciosMasivos(listaPrecios) {
    const filas = listaPrecios
      .filter((pr) => preciosMasivos[pr.id] !== undefined && Number(preciosMasivos[pr.id]) > 0)
      .map((pr) => {
        const { productoNombre, ...prLimpio } = pr;
        return { ...prLimpio, precio: Number(preciosMasivos[pr.id]), fecha: today() };
      });

    if (filas.length === 0) {
      cancelarEdicionMasiva();
      return;
    }

    setPrecios((prev) => {
      const porId = Object.fromEntries(filas.map((f) => [f.id, f]));
      return prev.map((x) => (porId[x.id] ? porId[x.id] : x));
    });
    cancelarEdicionMasiva();

    try {
      const res = await fetch("/api/tabla/precios_proveedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filas }),
      });
      const data = await res.json();
      if (data.status !== "ok") {
        setError("No se pudieron guardar los precios: " + (data.message || "error desconocido"));
        cargar();
      }
    } catch (err) {
      setError("Error de red al guardar los precios.");
      cargar();
    }
  }

  async function guardarPrecioEditado(pr) {
    if (!precioEditado || Number(precioEditado) <= 0) return;
    const { productoNombre, ...prLimpio } = pr;
    const actualizado = { ...prLimpio, precio: Number(precioEditado), fecha: today() };
    setPrecios((prev) => prev.map((x) => (x.id === pr.id ? actualizado : x)));
    setEditandoPrecioId(null);
    try {
      const res = await fetch("/api/tabla/precios_proveedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filas: [actualizado] }),
      });
      const data = await res.json();
      if (data.status !== "ok") {
        setError("No se pudo guardar el precio: " + (data.message || "error desconocido"));
        cargar();
      }
    } catch (err) {
      setError("Error de red al guardar el precio.");
      cargar();
    }
  }

  function abrirCargaPrecios(proveedor) {
    setCargaPreciosProveedor({ id: proveedor.id, nombre: proveedor.nombre });
    setArchivosCarga([]);
    setPasoCarga("subir");
    setErrorCarga(null);
    setItemsCarga([]);
  }

  function cerrarCargaPrecios() {
    setCargaPreciosProveedor(null);
    setArchivosCarga([]);
    setPasoCarga("subir");
    setErrorCarga(null);
    setItemsCarga([]);
  }

  async function manejarSeleccionArchivosCarga(e) {
    const archivos = Array.from(e.target.files || []);
    if (archivos.length === 0) return;
    setErrorCarga(null);
    const nuevos = [];
    for (const file of archivos) {
      const esImagen = file.type.startsWith("image/");
      if (esImagen) {
        try {
          const blob = await comprimirImagen(file);
          nuevos.push({ file: blob, nombre: file.name });
        } catch {
          setErrorCarga("No se pudo procesar una de las imágenes.");
        }
      } else {
        nuevos.push({ file, nombre: file.name });
      }
    }
    setArchivosCarga((prev) => [...prev, ...nuevos]);
  }

  function quitarArchivoCarga(index) {
    setArchivosCarga((prev) => prev.filter((_, i) => i !== index));
  }

  async function interpretarPreciosConIA() {
    if (archivosCarga.length === 0) {
      setErrorCarga("Sube al menos un archivo (foto, PDF, o Excel).");
      return;
    }
    setCargandoCarga(true);
    setErrorCarga(null);
    try {
      const formData = new FormData();
      archivosCarga.forEach((a) => formData.append("files", a.file, a.nombre));
      formData.append("proveedorId", cargaPreciosProveedor.id);

      const res = await fetch("/api/precios/interpret", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.status === "rate_limited") {
        setErrorCarga("El servicio de IA está ocupado. Tus archivos siguen cargados, intenta de nuevo en unos segundos.");
        return;
      }
      if (data.status !== "ok") {
        setErrorCarga(data.message || "No se pudo interpretar la lista de precios.");
        return;
      }

      const itemsConMatch = data.items.map((it) => {
        const nombreNormalizado = normalizarTexto(it.rawName);
        const match = productos.find((p) => normalizarTexto(p.nombre) === nombreNormalizado);
        return {
          ...it,
          productoId: match ? match.id : null,
          nombreProducto: match ? match.nombre : null,
        };
      });

      setItemsCarga(itemsConMatch);
      setPasoCarga("revisar");
    } catch (err) {
      setErrorCarga("No se pudo conectar con el servidor. " + err.message);
    } finally {
      setCargandoCarga(false);
    }
  }

  function asignarProductoCarga(index, productoId) {
    const producto = productos.find((p) => p.id === productoId);
    setItemsCarga((prev) =>
      prev.map((it, i) =>
        i === index
          ? { ...it, productoId: producto ? producto.id : null, nombreProducto: producto ? producto.nombre : null }
          : it
      )
    );
  }

  function actualizarPrecioCarga(index, valor) {
    setItemsCarga((prev) => prev.map((it, i) => (i === index ? { ...it, precio: Number(valor) } : it)));
  }

  function quitarItemCarga(index) {
    setItemsCarga((prev) => prev.filter((_, i) => i !== index));
  }

  async function guardarPreciosCargados() {
    const validos = itemsCarga.filter((it) => it.productoId && it.precio > 0);
    if (validos.length === 0) {
      setErrorCarga("No hay productos válidos para guardar (falta emparejar producto o precio).");
      return;
    }
    setCargandoCarga(true);
    setErrorCarga(null);
    try {
      const filas = validos.map((it) => {
        const existente = precios.find(
          (p) => p.proveedor_id === cargaPreciosProveedor.id && p.producto_id === it.productoId
        );
        return {
          id: existente ? existente.id : generarUUID(),
          proveedor_id: cargaPreciosProveedor.id,
          proveedor_nombre: cargaPreciosProveedor.nombre,
          producto_id: it.productoId,
          precio: Number(it.precio),
          fecha: today(),
        };
      });

      const res = await fetch("/api/tabla/precios_proveedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filas }),
      });
      const data = await res.json();
      if (data.status !== "ok") {
        setErrorCarga("No se pudieron guardar los precios: " + (data.message || "error desconocido"));
        return;
      }

      cerrarCargaPrecios();
      cargar();
    } catch (err) {
      setErrorCarga("Error de red al guardar los precios.");
    } finally {
      setCargandoCarga(false);
    }
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
    alerta: "#E35B4B",
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
                        <>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginBottom: "10px" }}>
                            {editandoMasivoId === p.id ? (
                              <>
                                <button
                                  onClick={() => guardarPreciosMasivos(preciosP)}
                                  style={{ background: colores.acento, border: "none", borderRadius: "6px", padding: "6px 12px", color: "#0B1420", fontWeight: 700, cursor: "pointer", fontSize: "12px" }}
                                >
                                  Guardar todos
                                </button>
                                <button
                                  onClick={cancelarEdicionMasiva}
                                  style={{ background: "none", border: `1px solid ${colores.borde}`, borderRadius: "6px", padding: "6px 12px", color: colores.textoSecundario, cursor: "pointer", fontSize: "12px" }}
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => abrirCargaPrecios(p)}
                                  style={{ background: colores.dorado, border: "none", borderRadius: "6px", padding: "6px 12px", color: "#0B1420", fontWeight: 700, cursor: "pointer", fontSize: "12px" }}
                                >
                                  Cargar lista
                                </button>
                                <button
                                  onClick={() => empezarEdicionMasiva(p.id, preciosP)}
                                  style={{ background: "none", border: `1px solid ${colores.acento}`, borderRadius: "6px", padding: "6px 12px", color: colores.acento, cursor: "pointer", fontSize: "12px" }}
                                >
                                  Editar todos
                                </button>
                              </>
                            )}
                          </div>
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
                                {editandoMasivoId === p.id ? (
                                  <input
                                    type="number"
                                    value={preciosMasivos[pr.id] ?? ""}
                                    onChange={(e) =>
                                      setPreciosMasivos((prev) => ({ ...prev, [pr.id]: e.target.value }))
                                    }
                                    style={{ width: "90px", padding: "6px", borderRadius: "6px", border: `1px solid ${colores.acento}`, background: "#0B1420", color: colores.texto, fontSize: "13px" }}
                                  />
                                ) : editandoPrecioId === pr.id ? (
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
                        </>
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

      {cargaPreciosProveedor && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#0F1B2A", borderRadius: "16px 16px 0 0", padding: "20px",
              width: "100%", maxWidth: "560px", maxHeight: "85vh", overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                Cargar precios — {cargaPreciosProveedor.nombre}
              </h2>
              <button
                onClick={cerrarCargaPrecios}
                style={{ background: "none", border: "none", color: colores.textoSecundario, fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {errorCarga && (
              <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid #FF5050", borderRadius: "8px", padding: "10px", marginBottom: "12px", fontSize: "13px", color: "#FF8080" }}>
                {errorCarga}
              </div>
            )}

            {pasoCarga === "subir" && (
              <>
                <p style={{ fontSize: "13px", color: colores.textoSecundario, marginBottom: "12px" }}>
                  Sube fotos, un PDF, o un archivo Excel (.xlsx) con la lista de precios de este proveedor.
                </p>
                <input
                  type="file"
                  accept="image/*,application/pdf,.xlsx"
                  multiple
                  onChange={manejarSeleccionArchivosCarga}
                  style={{ marginBottom: "12px", fontSize: "13px", color: colores.texto }}
                />
                {archivosCarga.length > 0 && (
                  <div style={{ display: "grid", gap: "6px", marginBottom: "12px" }}>
                    {archivosCarga.map((a, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", padding: "6px 8px", background: "#0B1420", borderRadius: "6px" }}>
                        <span>{a.nombre}</span>
                        <button
                          onClick={() => quitarArchivoCarga(i)}
                          style={{ background: "none", border: "none", color: colores.textoSecundario, cursor: "pointer", fontSize: "16px" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={interpretarPreciosConIA}
                  disabled={cargandoCarga || archivosCarga.length === 0}
                  style={{
                    width: "100%", background: colores.dorado, border: "none", borderRadius: "8px",
                    padding: "12px", color: "#0B1420", fontWeight: 700, cursor: "pointer", fontSize: "14px",
                    opacity: cargandoCarga || archivosCarga.length === 0 ? 0.5 : 1,
                  }}
                >
                  {cargandoCarga ? "Interpretando..." : "Interpretar archivos"}
                </button>
              </>
            )}

            {pasoCarga === "revisar" && (
              <>
                <p style={{ fontSize: "13px", color: colores.textoSecundario, marginBottom: "12px" }}>
                  Revisa cada producto detectado. Los marcados en rojo necesitan tu confirmación.
                </p>
                <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
                  {itemsCarga.map((it, i) => (
                    <div
                      key={i}
                      style={{
                        border: `1px solid ${it.needsReview || !it.productoId ? colores.alerta : colores.borde}`,
                        borderRadius: "8px", padding: "10px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 700, fontSize: "13px" }}>{it.rawName}</span>
                        <button
                          onClick={() => quitarItemCarga(i)}
                          style={{ background: "none", border: "none", color: colores.textoSecundario, cursor: "pointer", fontSize: "14px" }}
                        >
                          Quitar
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <select
                          value={it.productoId || ""}
                          onChange={(e) => asignarProductoCarga(i, e.target.value)}
                          style={{ flex: "1 1 160px", padding: "8px", borderRadius: "6px", border: `1px solid ${colores.borde}`, background: "#0B1420", color: colores.texto, fontSize: "13px" }}
                        >
                          <option value="">Elegir producto...</option>
                          {productos.map((prod) => (
                            <option key={prod.id} value={prod.id}>
                              {prod.nombre}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={it.precio}
                          onChange={(e) => actualizarPrecioCarga(i, e.target.value)}
                          style={{ width: "100px", padding: "8px", borderRadius: "6px", border: `1px solid ${colores.borde}`, background: "#0B1420", color: colores.texto, fontSize: "13px" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setPasoCarga("subir")}
                    style={{ flex: 1, background: "none", border: `1px solid ${colores.borde}`, borderRadius: "8px", padding: "12px", color: colores.textoSecundario, cursor: "pointer", fontSize: "14px" }}
                  >
                    Atrás
                  </button>
                  <button
                    onClick={guardarPreciosCargados}
                    disabled={cargandoCarga}
                    style={{
                      flex: 2, background: colores.acento, border: "none", borderRadius: "8px",
                      padding: "12px", color: "#0B1420", fontWeight: 700, cursor: "pointer", fontSize: "14px",
                      opacity: cargandoCarga ? 0.5 : 1,
                    }}
                  >
                    {cargandoCarga ? "Guardando..." : `Guardar ${itemsCarga.filter((it) => it.productoId && it.precio > 0).length} precios`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
