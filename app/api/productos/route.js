import { supabaseServidor } from "../../../lib/supabase";

// GET /api/productos → lista todos los productos
export async function GET() {
  try {
    const supabase = supabaseServidor();
    const { data, error } = await supabase.from("productos").select("*").order("nombre");
    if (error) return json({ status: "error", message: error.message }, 500);
    return json({ status: "ok", productos: data }, 200);
  } catch (e) {
    return json({ status: "error", message: e.message }, 500);
  }
}

// POST /api/productos → crea o actualiza uno o varios productos (upsert por id)
export async function POST(request) {
  try {
    const body = await request.json();
    const productos = Array.isArray(body.productos) ? body.productos : [body.producto];
    if (!productos || productos.length === 0 || !productos[0]) {
      return json({ status: "error", message: "No se recibió ningún producto." }, 400);
    }

    const filas = productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria || "",
      unidad: p.unidad || "unidad",
      stock_normal: p.stockNormal ?? 0,
      stock_medio: p.stockMedio ?? 0,
      stock_alto: p.stockAlto ?? 0,
      stock_bar: p.stockBar ?? 0,
      stock_bodega: p.stockBodega ?? 0,
      estado: p.estado || "Activo",
      fecha_actualizacion: p.fechaActualizacion || null,
    }));

    const supabase = supabaseServidor();
    const { data, error } = await supabase.from("productos").upsert(filas).select();
    if (error) return json({ status: "error", message: error.message }, 500);
    return json({ status: "ok", productos: data }, 200);
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
