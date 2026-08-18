"use client";
import { useState } from "react";

export default function TestPage() {
  const [files, setFiles] = useState([]);
  const [tipoCarga, setTipoCarga] = useState("actual");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

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

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontFamily: "Georgia, serif" }}>Prueba directa del backend de interpretación</h1>
      <p style={{ color: "#8CA2B6", fontSize: 14 }}>
        Esta página SOLO existe para confirmar que el backend interpreta bien tus 3 fotos reales,
        sin depender de nada de Claude.ai. Cuando esto funcione, conectamos InventarioApp a esta misma ruta.
      </p>

      <label style={{ display: "block", marginTop: 20, fontSize: 13, color: "#8CA2B6" }}>Tipo de carga</label>
      <select value={tipoCarga} onChange={(e) => setTipoCarga(e.target.value)}
        style={{ background: "#0E1A26", color: "#ECEFF2", border: "1px solid #24384D", borderRadius: 8, padding: 8, marginBottom: 16 }}>
        <option value="actual">Inventario actual / cierre</option>
        <option value="base">Base de temporada</option>
      </select>

      <input type="file" accept="image/*,application/pdf" multiple
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
        style={{ display: "block", marginBottom: 16 }} />

      <button onClick={interpretar} disabled={files.length === 0 || loading}
        style={{ background: "#C9A24B", color: "#0E1A26", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}>
        {loading ? "Interpretando…" : `Interpretar (${files.length} archivo${files.length === 1 ? "" : "s"})`}
      </button>

      {error && <p style={{ color: "#F0958D", marginTop: 16 }}>{error}</p>}

      {resultado && (
        <div style={{ marginTop: 24 }}>
          <div style={{ color: resultado.status === "ok" ? "#4FAE84" : "#F0958D", fontWeight: 600, marginBottom: 8 }}>
            status: {resultado.status}
          </div>
          {resultado.message && <p style={{ color: "#8CA2B6" }}>{resultado.message}</p>}
          {resultado.items && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#8CA2B6", borderBottom: "1px solid #24384D" }}>
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
                    <td style={{ padding: 6 }}>{it.closedUnits ?? "—"}</td>
                    <td style={{ padding: 6 }}>{it.openFraction ?? "—"}</td>
                    <td style={{ padding: 6 }}>{Math.round((it.confidence || 0) * 100)}%</td>
                    <td style={{ padding: 6 }}>{it.needsReview ? "⚠" : "✓"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", color: "#8CA2B6" }}>Ver JSON completo</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, background: "#142536", padding: 12, borderRadius: 8 }}>
              {JSON.stringify(resultado, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </main>
  );
}
