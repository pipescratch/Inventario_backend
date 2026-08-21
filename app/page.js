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

const colores = {
  fondo: "linear-gradient(180deg, #0B1420 0%, #10202B 100%)",
  tarjeta: "#16232E",
  borde: "#24333F",
  texto: "#F2EFE9",
  textoSecundario: "#9FB0BA",
  acento: "#2DD4BF",
  dorado: "#E3B04B",
};

const accesosRapidos = [
  { href: "/pedidos-anteriores", label: "Historial", icono: "📋" },
  { href: "/botellas-abiertas", label: "Botellas abiertas", icono: "🍾" },
  { href: "/proveedores", label: "Proveedores", icono: "🤝" },
];

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
    icono: "📦",
  },
  {
    href: "/configuracion",
    titulo: "Configurar bases",
    detalle: "Ajusta niveles Normal / Medio / Alto",
    icono: "⚙️",
  },
];

export default function Home() {
  return (
    <main
      style={{
        background: colores.fondo,
        fontFamily: body.style.fontFamily,
        minHeight: "100vh",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "40px 20px 56px" }}>
        {/* Encabezado */}
        <header style={{ marginBottom: "28px" }}>
          <p
            style={{
              color: colores.acento,
              fontWeight: 600,
              fontSize: "13px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            La Azotea Ocean Bar
          </p>
          <h1
            style={{
              fontFamily: display.style.fontFamily,
              color: colores.texto,
              fontWeight: 700,
              fontSize: "32px",
              margin: 0,
            }}
          >
            Inventario
          </h1>

          {/* Línea ondulada dorada, firma de la marca */}
          <svg width="120" height="10" viewBox="0 0 120 10" style={{ marginTop: "14px" }} aria-hidden="true">
            <path
              d="M0 5 Q 10 0, 20 5 T 40 5 T 60 5 T 80 5 T 100 5 T 120 5"
              fill="none"
              stroke={colores.dorado}
              strokeWidth="2"
            />
          </svg>
        </header>

        {/* Accesos rápidos: tarjetas compactas con ícono, arriba de todo */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "10px",
            marginBottom: "28px",
          }}
        >
          {accesosRapidos.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                background: colores.tarjeta,
                border: `1px solid ${colores.borde}`,
                borderRadius: "14px",
                padding: "14px 6px",
                textDecoration: "none",
              }}
            >
              <span style={{ fontSize: "22px" }}>{a.icono}</span>
              <span
                style={{
                  color: colores.texto,
                  fontSize: "12px",
                  fontWeight: 600,
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                {a.label}
              </span>
            </Link>
          ))}
        </section>

        {/* Acciones principales */}
        <section style={{ display: "grid", gap: "14px" }}>
          {acciones.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                background: colores.tarjeta,
                border: `1px solid ${colores.borde}`,
                borderRadius: "16px",
                padding: "20px",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  fontSize: "26px",
                  width: "52px",
                  height: "52px",
                  borderRadius: "12px",
                  background: "rgba(45, 212, 191, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {a.icono}
              </div>
              <div style={{ flex: 1 }}>
                <h2
                  style={{
                    fontFamily: display.style.fontFamily,
                    color: colores.texto,
                    fontWeight: 700,
                    fontSize: "17px",
                    margin: "0 0 3px 0",
                  }}
                >
                  {a.titulo}
                </h2>
                <p style={{ color: colores.textoSecundario, fontSize: "13px", margin: 0 }}>
                  {a.detalle}
                </p>
              </div>
              <span style={{ color: colores.dorado, fontSize: "20px" }}>→</span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
