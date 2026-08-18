import Link from "next/link";
import { Space_Grotesk, Inter } from "next/font/google";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
});
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      style={{
        background: "#F7F5F1",
        fontFamily: body.style.fontFamily,
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "48px 24px",
        }}
      >
        {/* Encabezado */}
        <header style={{ marginBottom: "40px" }}>
          <p
            style={{
              color: "#0E7C86",
              fontWeight: 600,
              fontSize: "14px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            La Azotea Ocean Bar
          </p>
          <h1
            style={{
              fontFamily: display.style.fontFamily,
              color: "#1B2A32",
              fontWeight: 700,
              fontSize: "34px",
              margin: 0,
            }}
          >
            Inventario
          </h1>

          {/* Divisor de firma: línea ondulada */}
          <svg
            width="120"
            height="10"
            viewBox="0 0 120 10"
            style={{ marginTop: "16px" }}
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
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          {acciones.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              style={{
                display: "block",
                background: "#FFFFFF",
                border: "1px solid #E5E1D8",
                borderRadius: "16px",
                padding: "24px",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontSize: "30px", marginBottom: "16px" }}>
                {a.icono}
              </div>
              <h2
                style={{
                  fontFamily: display.style.fontFamily,
                  color: "#1B2A32",
                  fontWeight: 700,
                  fontSize: "18px",
                  margin: "0 0 4px 0",
                }}
              >
                {a.titulo}
              </h2>
              <p style={{ color: "#5B6B72", fontSize: "14px", margin: 0 }}>
                {a.detalle}
              </p>
            </Link>
          ))}
        </section>

        {/* Accesos secundarios */}
        <nav style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {accesosSecundarios.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                fontSize: "14px",
                padding: "8px 16px",
                borderRadius: "999px",
                color: "#1B2A32",
                border: "1px solid #E5E1D8",
                background: "#FFFFFF",
                textDecoration: "none",
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
