import Link from "next/link";
import { Space_Grotesk, Inter } from "next/font/google";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
});
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const acciones = [
  {
    href: "/pedido",
    titulo: "Hacer pedido semanal",
    detalle: "Sube fotos del inventario y genera el pedido",
    icono: "📸",
  },
  {
    href: "/inventario",
    titulo: "Ver inventario",
    detalle: "Consulta el estado actual de bar y bodega",
    icono: "📋",
  },
  {
    href: "/configuracion",
    titulo: "Configurar bases",
    detalle: "Ajusta niveles Normal / Medio / Alto",
    icono: "⚙️",
  },
];

const accesosSecundarios = [
  { href: "/pedidos-anteriores", label: "Pedidos anteriores" },
  { href: "/productos", label: "Productos" },
  { href: "/proveedores", label: "Proveedores" },
];

export default function Home() {
  return (
    <main
      className={`${display.variable} ${body.variable} min-h-screen`}
      style={{ background: "#F7F5F1", fontFamily: "var(--font-body)" }}
    >
      <div className="max-w-5xl mx-auto px-6 py-10 md:py-16">
        {/* Encabezado */}
        <header className="mb-10">
          <p
            className="text-sm tracking-wide uppercase mb-2"
            style={{ color: "#0E7C86", fontWeight: 600 }}
          >
            La Azotea Ocean Bar
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              color: "#1B2A32",
              fontWeight: 700,
            }}
            className="text-3xl md:text-4xl"
          >
            Inventario
          </h1>

          {/* Divisor de firma: línea ondulada */}
          <svg
            width="120"
            height="10"
            viewBox="0 0 120 10"
            className="mt-4"
            aria-hidden="true"
          >
            <path
              d="M0 5 Q 10 0, 20 5 T 40 5 T 60 5 T 80 5 T 100 5 T 120 5"
              fill="none"
              stroke="#C9A227"
              strokeWidth="2"
            />
          </svg>
        </header>

        {/* Acciones principales */}
        <section className="grid gap-4 md:grid-cols-3 mb-10">
          {acciones.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group block rounded-2xl p-6 transition-colors"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E5E1D8",
              }}
            >
              <div className="text-3xl mb-4">{a.icono}</div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  color: "#1B2A32",
                  fontWeight: 700,
                }}
                className="text-lg mb-1 group-hover:opacity-80"
              >
                {a.titulo}
              </h2>
              <p style={{ color: "#5B6B72" }} className="text-sm">
                {a.detalle}
              </p>
            </Link>
          ))}
        </section>

        {/* Accesos secundarios */}
        <nav className="flex flex-wrap gap-3">
          {accesosSecundarios.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm px-4 py-2 rounded-full transition-colors"
              style={{
                color: "#1B2A32",
                border: "1px solid #E5E1D8",
                background: "#FFFFFF",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
