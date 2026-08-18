"use client";
import { useState } from "react";

export default function TestPage() {
  const [files, setFiles] = useState([]);
  const [tipoCarga, setTipoCarga] = useState("actual");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const [tablaNombre, setTablaNombre] = useState("categorias");
  const [tablaFilas, setTablaFilas] = useState('[{"nombre": "Ejemplo"}]');
  const [tablaLoading, setTablaLoading] = useState(false);
  const [tablaResultado, setTablaResultado] = useState(null);
  const [tablaError, setTablaError] = useState(null);

  async function interpretar() {
    if (files.length === 0) return;
    setLoading(true); setResultado(null); setError(null);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      formData.append("tipoCarga", tipoCarga);
      const res = await fetch("/api/inventory/interpret", { method: "POST", body: formData });
      const data = await res.json();
      setResultado(data);
    } catch (e) {
      setError(e.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function probarTablaGET() {
    setTablaLoading(true); setTablaResultado(null); setTablaError(null);
    try {
      const res = await fetch(`/api/tabla/${tablaNombre}`, { method: "GET" });
      const data = await res.json();
      setTablaResultado(data);
    } catch (e) {
      setTablaError(e.message || "Error desconocido");
    } finally {
      setTablaLoading(false);
    }
  }

  async function probarTablaPOST() {
    setTablaLoading(true); setTablaResultado(null); setTablaError(null);
    try {
      let filasParsed;
      try {
        filasParsed = JSON.parse(tablaFilas);
      } catch {
        throw new Error("El JSON de filas no es válido. Revisa el formato.");
      }
      const res = await fetch(`/api/tabla/${tablaNombre}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filas: filasParsed }),
      });
      const data = await res.json();
      setTablaResultado(data);
    } catch (e) {
      setTablaError(e.message || "Error desconocido");
    } finally {
      setTablaLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontFamily: "Georgia, serif" }}>Prueba directa del backend de InventarioApp</h1>
      <p style={{ color: "#8CA2B6", fontSize: 14 }}>
        Esta página SOLO existe para confirmar que el backend interpreta bien las fotos,
        sin depender de nada de Claude.ai. Cuando esto funcione, conectamos InventarioApp.
      </p>

      <label style={{ display: "block", marginTop: 20, fontSize: 13, color: "#8CA2B6" }}>
        <select value={tipoCarga} onChange={(e) => setTipoCarga(e.target.value)}
          style={{ background: "#0E1A26", color: "#ECEFF2", border: "1px solid #2A3B4D" }}>
          <option value="actual">Inventario actual / cierre</option>
          <option value="base">Base de temporada</option>
        </select>
      </label>

      <input type="file" accept="image/*,application/pdf" multiple
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
        style={{ display: "block", marginBottom: 16 }} />

      <button onClick={interpretar} disabled={files.length === 0 || loading}
        style={{ background: "#C9A24B", color: "#0E1A26", border: "none", borderRadius: 6, padding: "10px 16px", cursor: "pointer" }}>
        {loading ? "Interpretando…" : `Interpretar (${files.length} archivo${files.length === 1 ? "" : "s"})`}
      </button>

      {error && <p style={{ color: "#F0958D", marginTop: 16 }}>{error}</p>}

      {resultado && (
        <div style={{ marginTop: 24 }}>
          <div style={{ color: resultado.status === "ok" ? "#4FAE84" : "#F0958D" }}>
            status: {resultado.status}
          </div>
          {resultado.message && <p style={{ color: "#8CA2B6" }}>{resultado.message}</p>}
          {resultado.items && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#8CA2B6", borderBottom: "1px solid #2A3B4D" }}>
                  <th style={{ padding: 6 }}>Producto detectado</th>
                  <th style={{ padding: 6 }}>Cerradas</th>
                  <th style={{ padding: 6 }}>Fracción abierta</th>
                  <th style={{ padding: 6 }}>Confianza</th>
                  <th style={{ padding: 6 }}>Revisar</th>
                </tr>
              </thead>
              <tbody>
                {resultado.items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1B3049" }}>
                    <td style={{ padding: 6 }}>{it.rawName}</td>
                    <td style={{ padding: 6 }}>{it.closedUnits ?? "-"}</td>
                    <td style={{ padding: 6 }}>{it.openFraction ?? "-"}</td>
                    <td style={{ padding: 6 }}>{Math.round((it.confidence || 0) * 100)}%</td>
                    <td style={{ padding: 6 }}>{it.needsReview ? "⚠" : "✓"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", color: "#8CA2B6" }}>Ver JSON completo</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, background: "#111" }}>
              {JSON.stringify(resultado, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <hr style={{ margin: "40px 0", borderColor: "#2A3B4D" }} />

      <h2 style={{ fontFamily: "Georgia, serif" }}>Prueba directa de /api/tabla/[nombre]</h2>
      <p style={{ color: "#8CA2B6", fontSize: 14 }}>
        Prueba leer (GET) o guardar (POST) filas en cualquier tabla permitida.
      </p>

      <label style={{ display: "block", marginTop: 20, fontSize: 13, color: "#8CA2B6" }}>
        Nombre de tabla:
        <select value={tablaNombre} onChange={(e) => setTablaNombre(e.target.value)}
          style={{ display: "block", background: "#0E1A26", color: "#ECEFF2", border: "1px solid #2A3B4D", marginTop: 6 }}>
          <option value="categorias">categorias</option>
          <option value="proveedores">proveedores</option>
          <option value="estaciones">estaciones</option>
          <option value="aliases_producto">aliases_producto</option>
          <option value="configuracion">configuracion</option>
        </select>
      </label>

      <label style={{ display: "block", marginTop: 16, fontSize: 13, color: "#8CA2B6" }}>
        Filas a guardar (JSON, solo para POST):
        <textarea value={tablaFilas} onChange={(e) => setTablaFilas(e.target.value)}
          rows={5}
          style={{ display: "block", width: "100%", background: "#0E1A26", color: "#ECEFF2", border: "1px solid #2A3B4D", marginTop: 6, fontFamily: "monospace", fontSize: 12 }} />
      </label>

      <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
        <button onClick={probarTablaGET} disabled={tablaLoading}
          style={{ background: "#4FAE84", color: "#0E1A26", border: "none", borderRadius: 6, padding: "10px 16px", cursor: "pointer" }}>
          {tablaLoading ? "Cargando…" : "Probar GET"}
        </button>
        <button onClick={probarTablaPOST} disabled={tablaLoading}
          style={{ background: "#C9A24B", color: "#0E1A26", border: "none", borderRadius: 6, padding: "10px 16px", cursor: "pointer" }}>
          {tablaLoading ? "Guardando…" : "Probar POST"}
        </button>
      </div>

      {tablaError && <p style={{ color: "#F0958D", marginTop: 16 }}>{tablaError}</p>}

      {tablaResultado && (
        <details open style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", color: "#8CA2B6" }}>Resultado</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, background: "#111" }}>
            {JSON.stringify(tablaResultado, null, 2)}
          </pre>
        </details>
      )}
    </main>
  );
}
