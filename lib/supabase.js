import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase para uso SOLO del servidor (usa la clave secreta,
// que tiene acceso completo saltándose RLS). Nunca importar esto en
// código que corra en el navegador.
export function supabaseServidor() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en las variables de entorno.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
