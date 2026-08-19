import { supabaseServidor } from "../../../../lib/supabase";

// Ruta genérica para tablas simples (sin lógica especial):
// categorias, proveedores, estaciones, aliases_producto, configuracion, botellas_trabajo
//
// GET  /api/tabla/proveedores          → lista todas las filas
// POST /api/tabla/proveedores          → upsert de filas: { filas: [{...}] }
// Body de POST espera nombres de columna EXACTOS de la base de datos (snake_case).

const TABLAS_PERMITIDAS = new Set([
  "categorias",
  "proveedores",
  "estaciones",
  "aliases_producto",
  "configuracion",
  "botellas_trabajo",
  "precios_proveedor",
]);

export async function GET(request, { params }) {
  const { nombre } = params;
  if (!TABLAS_PERMITIDAS.has(nombre)) {
    return json({ status: "error", message: `Tabla no permitida: ${nombre}` }, 400);
  }
  try {
    const supabase = supabaseServidor();
    const { data, error } = await supabase.from(nombre).select("*");
    if (error) return json({ status: "error", message: error.message }, 500);
    return json({ status: "ok", filas: data }, 200);
  } catch (e) {
    return json({ status: "error", message: e.message }, 500);
  }
}

export async function POST(request, { params }) {
  const { nombre } = params;
  if (!TABLAS_PERMITIDAS.has(nombre)) {
    return json({ status: "error", message: `Tabla no permitida: ${nombre}` }, 400);
  }
  try {
    const body = await request.json();
    const filas = Array.isArray(body.filas) ? body.filas : null;
    if (!filas || filas.length === 0) {
      return json({ status: "error", message: "No se recibieron filas para guardar." }, 400);
    }
    const conflictKey = nombre === "configuracion" ? "clave" : "id";
    const supabase = supabaseServidor();
    const { data, error } = await supabase.from(nombre).upsert(filas, { onConflict: conflictKey }).select();
    if (error) return json({ status: "error", message: error.message }, 500);
    return json({ status: "ok", filas: data }, 200);
  } catch (e) {
    return json({ status: "error", message: e.message }, 500);
  }
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
