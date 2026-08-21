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

// Íconos de línea propios (stroke = currentColor), en vez de emoji, para que
// se vean igual en cualquier dispositivo y con el mismo peso visual.
function IconoCamara(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}
function IconoCaja(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 8l9-4 9 4-9 4-9-4z" />
      <path d="M3 8v9l9 4 9-4V8" />
      <path d="M12 12v9" />
    </svg>
  );
}
function IconoDeslizadores(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M21 18h-1" />
      <circle cx="15" cy="6" r="2.1" />
      <circle cx="7" cy="12" r="2.1" />
      <circle cx="17" cy="18" r="2.1" />
    </svg>
  );
}
function IconoReloj(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </svg>
  );
}
function IconoBotella(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 2h4v3.2c0 .5.2 1 .6 1.4l1 1c.9.9 1.4 2 1.4 3.3V20a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V10.9c0-1.3.5-2.4 1.4-3.3l1-1c.4-.4.6-.9.6-1.4V2z" />
      <path d="M9 13h6" />
      <path d="M10 2h4" />
    </svg>
  );
}
function IconoApreton(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 12l4-3 3 2 4-3 3 2 4-2v6l-4 2-3-2-4 3-3-2-4 1z" />
      <path d="M8 11l2 2 3-3" />
    </svg>
  );
}

const accesosRapidos = [
  { href: "/pedidos-anteriores", label: "Historial", Icono: IconoReloj },
  { href: "/botellas-abiertas", label: "Botellas abiertas", Icono: IconoBotella },
  { href: "/proveedores", label: "Proveedores", Icono: IconoApreton },
];

const acciones = [
  {
    href: "/pedido",
    titulo: "Hacer pedido semanal",
    detalle: "Sube fotos del inventario y genera el pedido",
    Icono: IconoCamara,
  },
  {
    href: "/inventario",
    titulo: "Ver inventario",
    detalle: "Consulta el estado actual de bar y bodega",
    Icono: IconoCaja,
  },
  {
    href: "/configuracion",
    titulo: "Configurar bases",
    detalle: "Ajusta niveles Normal / Medio / Alto",
    Icono: IconoDeslizadores,
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
        <header style={{ marginBottom: "28px", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#F2EFE9",
              borderRadius: "18px",
              padding: "16px 28px",
              marginBottom: "16px",
            }}
          >
            <img
              src="/logo_azt.png"
              alt="La Azotea Ocean Bar"
              style={{ height: "56px", width: "auto", display: "block" }}
            />
          </div>
          <h1
            style={{
              fontFamily: display.style.fontFamily,
              color: colores.texto,
              fontWeight: 700,
              fontSize: "28px",
              margin: 0,
            }}
          >
            Inventario
          </h1>
          <p
            style={{
              color: colores.acento,
              fontWeight: 600,
              fontSize: "12px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              margin: "6px 0 0",
            }}
          >
            La Azotea Ocean Bar
          </p>

          {/* Línea ondulada dorada, firma de la marca */}
          <svg width="120" height="10" viewBox="0 0 120 10" style={{ marginTop: "16px", display: "inline-block" }} aria-hidden="true">
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
          {accesosRapidos.map(({ href, label, Icono }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                background: colores.tarjeta,
                border: `1px solid ${colores.borde}`,
                borderRadius: "14px",
                padding: "16px 6px",
                textDecoration: "none",
              }}
            >
              <Icono style={{ color: colores.acento }} />
              <span
                style={{
                  color: colores.texto,
                  fontSize: "12px",
                  fontWeight: 600,
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                {label}
              </span>
            </Link>
          ))}
        </section>

        {/* Acciones principales */}
        <section style={{ display: "grid", gap: "14px" }}>
          {acciones.map(({ href, titulo, detalle, Icono }) => (
            <Link
              key={href}
              href={href}
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
                  width: "52px",
                  height: "52px",
                  borderRadius: "12px",
                  background: "rgba(45, 212, 191, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: colores.acento,
                }}
              >
                <Icono width="26" height="26" />
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
                  {titulo}
                </h2>
                <p style={{ color: colores.textoSecundario, fontSize: "13px", margin: 0 }}>
                  {detalle}
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
