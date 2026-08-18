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
        background: "linear-gradient(180deg, #0B1420 0%, #10202B 100%)",
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
              color: "#2DD4BF",
              fontWeight: 600,
              fontSize: "14px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            La Azotea Ocean Bar
          </p>
          <h1
            style={{
              fontFamily: display.style.fontFamily,
              color: "#F2EFE9",
              fontWeight: 700,
              fontSize: "34px",
              margin: 0,
            }}
          >
            Inventario
          </h1>

          {/* Divisor de firma: línea ondulada dorada */}
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
              stroke="#E3B04B"
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
                background: "#16232E",
                border: "1px solid #24333F",
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
                  color: "#F2EFE9",
                  fontWeight: 700,
                  fontSize: "18px",
                  margin: "0 0 4px 0",
                }}
              >
                {a.titulo}
              </h2>
              <p style={{ color: "#9FB0BA", fontSize: "14px", margin: 0 }}>
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
                color: "#F2EFE9",
                border: "1px solid #24333F",
                background: "#16232E",
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
