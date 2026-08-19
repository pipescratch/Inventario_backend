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

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/tabla/proveedores");
      const data = await res.json();
      if (data.status !== "ok") {
        setError(data.message || "No se pudo cargar los proveedores.");
        return;
      }
      setProveedores(data.filas);
    } catch (err) {
      setError("No se pudo conectar con el servidor. " + err.message);
    } finally {
      setCargando(false);
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
          <Link
            href="/"
            style={{ color: colores.textoSecundario, textDecoration: "none", fontSize: "14px" }}
          >
            ← Inicio
          </Link>
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
            {proveedores.map((p) => (
              <div
                key={p.id}
                style={{
                  background: colores.tarjeta,
                  border: `1px solid ${colores.borde}`,
                  borderRadius: "14px",
                  padding: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                  <div style={{ color: colores.textoSecundario, fontSize: "13px" }}>
                    {[p.telefono, p.contacto].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                  </div>
                </div>
                <button
                  onClick={() => setEditando(p)}
                  style={{
                    background: "none",
                    border: `1px solid ${colores.borde}`,
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: colores.acento,
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  Editar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
