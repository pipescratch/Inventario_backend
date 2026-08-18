export const metadata = { title: "Prueba de interpretación — InventarioApp" };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ background: "#0E1A26", color: "#ECEFF2", fontFamily: "system-ui, sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
