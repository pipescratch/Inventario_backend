"use client";

import { useState } from "react";
import Link from "next/link";

const niveles = [
  { id: "normal", label: "Normal", detalle: "Temporada baja" },
  { id: "medio", label: "Medio", detalle: "Temporada media" },
  { id: "alto", label: "Alto", detalle: "Alta temporada / eventos" },
];

const ubicaciones = [
  { id: "bar", label: "Bar" },
  { id: "bodega", label: "Bodega" },
];

// Comprime una imagen en el navegador antes de enviarla,
// para no pasar el límite de 4.5MB por request de Vercel.
// Devuelve un Blob (no base64), porque el backend espera multipart/form-data.
function comprimirImagen(file, maxWidth = 1600, calidad = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * escala;
        canvas.height = img.height * escala;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve({ blob, preview: canvas.toDataURL("image/jpeg", calidad) });
            else reject(new Error("No se pudo comprimir la imagen"));
          },
          "image/jpeg",
          calidad
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Normaliza texto para comparar nombres (minúsculas, sin acentos, sin espacios extra)
function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function generarUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

export default function Pedido() {
  const [paso, setPaso] = useState("config"); // config | fotos | revisar | comparar
  const [nivel, setNivel] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [fechaConteo, setFechaConteo] = useState(today());
  const [fotos, setFotos] = useState([]); // { preview, blob }
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [comparacion, setComparacion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [pedidoPorProveedor, setPedidoPorProveedor] = useState(null);
  const [copiado, setCopiado] = useState(null);
  const [copiadoSinProveedor, setCopiadoSinProveedor] = useState(false);
  const [historialId, setHistorialId] = useState(null);
  const [pedidoId, setPedidoId] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pedidoConfirmado, setPedidoConfirmado] = useState(false);

  async function manejarSeleccionFotos(e) {
    const archivos = Array.from(e.target.files || []);
    if (archivos.length === 0) return;

    setError(null);
    const nuevas = [];
    for (const file of archivos) {
      try {
        const { blob, preview } = await comprimirImagen(file);
        nuevas.push({ preview, blob });
      } catch {
        setError("No se pudo procesar una de las imágenes. Intenta de nuevo.");
      }
    }
    setFotos((prev) => [...prev, ...nuevas]);
  }

  function quitarFoto(index) {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  }

  function actualizarItem(index, campo, valor) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [campo]: valor } : it))
    );
  }

  async function interpretarConIA() {
    if (fotos.length === 0) {
      setError("Sube al menos una foto del inventario.");
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const formData = new FormData();
      fotos.forEach((f, i) => {
        formData.append("files", f.blob, `foto-${i + 1}.jpg`);
      });
      formData.append("tipoCarga", "actual");
      if (ubicacion) formData.append("ubicacion", ubicacion);

      const res = await fetch("/api/inventory/interpret", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.status === "rate_limited") {
        setError(
          "El servicio de IA está ocupado por ahora. Tus fotos siguen cargadas, intenta de nuevo en unos segundos."
        );
        return;
      }
      if (data.status !== "ok") {
        setError(data.message || "No se pudo interpretar el inventario.");
        return;
      }

      setItems(data.items);
      setPaso("revisar");
    } catch (err) {
      setError("No se pudo conectar con el servidor. " + err.message);
    } finally {
      setCargando(false);
    }
  }

  async function compararConCatalogo() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/productos");
      const data = await res.json();
      if (data.status !== "ok") {
        setError(data.message || "No se pudo cargar el catálogo de productos.");
        return;
      }
      setCatalogo(data.productos);

      const objetivoCampo =
        nivel === "normal" ? "stock_normal" : nivel === "medio" ? "stock_medio" : "stock_alto";
      const stockCampo = ubicacion === "bar" ? "stock_bar" : "stock_bodega";

      const filas = items.map((it) => {
        const closedUnits = Number(it.closedUnits) || 0;
        const openFraction = Number(it.openFraction) || 0;
        // Para comparar contra el objetivo se sigue considerando lo abierto
        // como parte del stock disponible (una botella abierta cuenta).
        const cantidadDetectada = closedUnits + openFraction;
        const nombreNormalizado = normalizar(it.rawName);
        const match = data.productos.find(
          (p) => normalizar(p.nombre) === nombreNormalizado
        );
        const objetivo = match ? match[objetivoCampo] || 0 : null;
        // El pedido se calcula solo con botellas cerradas (enteras). Una
        // botella abierta a la mitad no reduce lo que hay que comprar:
        // esa fracción se registra aparte como botella de trabajo.
        const diferencia = match ? Math.max(0, Math.ceil(objetivo - closedUnits)) : null;

        return {
          rawName: it.rawName,
          closedUnits,
          openFraction,
          cantidadDetectada,
          productoId: match ? match.id : null,
          nombreProducto: match ? match.nombre : null,
          objetivo,
          diferencia,
        };
      });

      setComparacion(filas);
      setPaso("comparar");
    } catch (err) {
      setError("No se pudo conectar con el catálogo. " + err.message);
    } finally {
      setCargando(false);
    }
  }

  function asignarProducto(index, productoId) {
    const producto = catalogo.find((p) => p.id === productoId);
    const objetivoCampo =
      nivel === "normal" ? "stock_normal" : nivel === "medio" ? "stock_medio" : "stock_alto";
    setComparacion((prev) =>
      prev.map((fila, i) => {
        if (i !== index) return fila;
        if (!producto) {
          return { ...fila, productoId: null, nombreProducto: null, objetivo: null, diferencia: null };
        }
        const objetivo = producto[objetivoCampo] || 0;
        return {
          ...fila,
          productoId: producto.id,
          nombreProducto: producto.nombre,
          objetivo,
          diferencia: Math.max(0, Math.ceil(objetivo - fila.closedUnits)),
        };
      })
    );
  }

  async function guardarConteo() {
    setGuardando(true);
    setError(null);
    try {
      const stockCampo = ubicacion === "bar" ? "stock_bar" : "stock_bodega";
      const productosActualizados = comparacion
        .filter((f) => f.productoId)
        .map((f) => {
          const original = catalogo.find((p) => p.id === f.productoId);
          return {
            id: original.id,
            nombre: original.nombre,
            categoria: original.categoria,
            unidad: original.unidad,
            stockNormal: original.stock_normal,
            stockMedio: original.stock_medio,
            stockAlto: original.stock_alto,
            // El stock cerrado solo cuenta botellas cerradas.
            // La fracción abierta se registra aparte como botella de trabajo.
            stockBar: stockCampo === "stock_bar" ? f.closedUnits : original.stock_bar,
            stockBodega: stockCampo === "stock_bodega" ? f.closedUnits : original.stock_bodega,
            estado: original.estado,
          };
        });

      if (productosActualizados.length === 0) {
        setError("No hay productos identificados para guardar.");
        return;
      }

      // Reconciliación de botellas abiertas contra el conteo nuevo:
      // 1) Si el producto sigue con fracción abierta y bajó o se mantuvo
      //    parecida, se actualiza la misma botella de trabajo.
      // 2) Si la fracción SUBIÓ mucho (más de 2 tragos de diferencia), se
      //    asume que la anterior se acabó y abrieron una nueva: se cierra
      //    la vieja como "terminada" y se crea una nueva con fecha de hoy.
      // 3) Si un producto que tenía botella activa ya NO aparece con
      //    fracción abierta en este conteo, se asume terminada y se cierra.
      // La reconciliación de botellas abiertas solo aplica a conteos de
      // Barra: un conteo de Bodega no vuelve a mirar las botellas abiertas,
      // así que no debe interpretarse como que "se acabaron".
      const conBotellaAbierta = comparacion.filter((f) => f.productoId && f.openFraction > 0);
      if (ubicacion === "bar") {
        const resBot = await fetch("/api/tabla/botellas_trabajo");
        const dataBot = await resBot.json();
        const botellasExistentes = dataBot.status === "ok" ? dataBot.filas : [];
        const activasBarra = botellasExistentes.filter((b) => b.estacion_id === "barra" && b.estado === "activa");

        const productosConAbiertaHoy = new Set(conBotellaAbierta.map((f) => f.productoId));
        const botellasAGuardar = [];

        // Casos 1 y 2: productos que sí tienen fracción abierta en este conteo.
        conBotellaAbierta.forEach((f) => {
          const existente = activasBarra.find((b) => b.producto_id === f.productoId);
          const tragos = Math.round(f.openFraction * 12);

          if (existente && tragos > existente.tragos + 2) {
            // Subió mucho: la anterior se acabó, se abrió una nueva.
            botellasAGuardar.push({
              ...existente,
              estado: "terminada",
              cantidad_final: existente.tragos,
              fecha_terminacion: fechaConteo,
              hora_terminacion: nowTime(),
            });
            botellasAGuardar.push({
              id: generarUUID(),
              producto_id: f.productoId,
              estacion_id: "barra",
              tragos,
              cantidad_inicial: 12,
              fecha_apertura: fechaConteo,
              hora_apertura: nowTime(),
              estado: "activa",
            });
          } else {
            botellasAGuardar.push({
              id: existente ? existente.id : generarUUID(),
              producto_id: f.productoId,
              estacion_id: "barra",
              tragos,
              cantidad_inicial: existente ? existente.cantidad_inicial : 12,
              fecha_apertura: existente ? existente.fecha_apertura : fechaConteo,
              hora_apertura: existente ? existente.hora_apertura : nowTime(),
              estado: "activa",
            });
          }
        });

        // Caso 3: botellas activas de antes cuyo producto ya no aparece
        // con fracción abierta en este conteo nuevo → se cierran solas.
        activasBarra
          .filter((b) => !productosConAbiertaHoy.has(b.producto_id))
          .forEach((b) => {
            botellasAGuardar.push({
              ...b,
              estado: "terminada",
              cantidad_final: b.tragos,
              fecha_terminacion: fechaConteo,
              hora_terminacion: nowTime(),
            });
          });

        if (botellasAGuardar.length > 0) {
          const resGuardarBot = await fetch("/api/tabla/botellas_trabajo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filas: botellasAGuardar }),
          });
          const dataGuardarBot = await resGuardarBot.json();
          if (dataGuardarBot.status !== "ok") {
            setError("No se pudo registrar la botella abierta: " + (dataGuardarBot.message || "error desconocido"));
            setGuardando(false);
            return;
          }
        }
      }

      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productos: productosActualizados }),
      });
      const data = await res.json();
      if (data.status !== "ok") {
        setError(data.message || "No se pudo guardar el conteo.");
        return;
      }
      setGuardado(true);

      // Guarda una foto fija de este conteo en el historial, con su fecha.
      const registroHistorial = {
        id: generarUUID(),
        fecha: fechaConteo,
        hora: nowTime(),
        nivel,
        ubicacion,
        items: comparacion,
      };
      await fetch("/api/tabla/historial_inventarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filas: [registroHistorial] }),
      });
      setHistorialId(registroHistorial.id);

      await armarPedidoPorProveedor();
    } catch (err) {
      setError("No se pudo guardar. " + err.message);
    } finally {
      setGuardando(false);
    }
  }

  // Cruza los productos a comprar (los que tienen diferencia > 0) contra
  // los precios registrados por proveedor, y elige automáticamente el
  // proveedor más barato para cada producto. Agrupa el resultado por
  // proveedor para poder copiarlo como pedido en WhatsApp.
  async function armarPedidoPorProveedor() {
    try {
      const [res, resProv] = await Promise.all([
        fetch("/api/tabla/precios_proveedor"),
        fetch("/api/tabla/proveedores"),
      ]);
      const data = await res.json();
      const dataProv = await resProv.json();
      const precios = data.status === "ok" ? data.filas : [];
      const proveedoresLista = dataProv.status === "ok" ? dataProv.filas : [];

      const aComprar = comparacion.filter((f) => f.productoId && f.diferencia > 0);

      const grupos = {}; // proveedorId -> { nombre, items: [], total, telefono }
      const sinProveedor = [];

      aComprar.forEach((item) => {
        const opciones = precios
          .filter((p) => p.producto_id === item.productoId)
          .sort((a, b) => a.precio - b.precio);

        if (opciones.length === 0) {
          sinProveedor.push(item);
          return;
        }

        const mejor = opciones[0];
        const totalItem = mejor.precio * item.diferencia;

        if (!grupos[mejor.proveedor_id]) {
          const proveedorInfo = proveedoresLista.find((pv) => pv.id === mejor.proveedor_id);
          grupos[mejor.proveedor_id] = {
            proveedorId: mejor.proveedor_id,
            proveedorNombre: mejor.proveedor_nombre,
            telefono: proveedorInfo ? proveedorInfo.telefono : null,
            items: [],
            total: 0,
          };
        }
        grupos[mejor.proveedor_id].items.push({
          productoId: item.productoId,
          nombre: item.rawName,
          cantidad: item.diferencia,
          precio: mejor.precio,
          total: totalItem,
        });
        grupos[mejor.proveedor_id].total += totalItem;
      });

      const pedidoArmado = {
        grupos: Object.values(grupos).sort((a, b) => a.proveedorNombre.localeCompare(b.proveedorNombre)),
        sinProveedor,
      };
      setPedidoPorProveedor(pedidoArmado);

      // Se guarda de inmediato como "pendiente", para que quede en el
      // Historial aunque no se confirme la compra en este mismo momento.
      const todosLosItems = pedidoArmado.grupos.flatMap((g) =>
        g.items.map((it) => ({ ...it, proveedor: g.proveedorNombre }))
      );
      const costoTotal = pedidoArmado.grupos.reduce((s, g) => s + g.total, 0);

      if (todosLosItems.length > 0) {
        const resPedidos = await fetch("/api/tabla/pedidos");
        const dataPedidos = await resPedidos.json();
        const numero = (dataPedidos.status === "ok" ? dataPedidos.filas.length : 0) + 1;
        const idNuevo = generarUUID();

        await fetch("/api/tabla/pedidos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filas: [
              {
                id: idNuevo,
                numero,
                fecha: fechaConteo,
                hora: nowTime(),
                nivel,
                estado: "pendiente",
                items: { ubicacion, lineas: todosLosItems },
                costo_total: costoTotal,
                inventario_id: historialId,
              },
            ],
          }),
        });
        setPedidoId(idNuevo);
      }

      setPaso("resumen");
    } catch (err) {
      setError("No se pudo armar el pedido por proveedor. " + err.message);
    }
  }

  function textoWhatsApp(grupo) {
    const lineas = grupo.items.map(
      (it, i) => `${i + 1}. ${it.nombre}\n   ${it.cantidad} un. × $${Math.round(it.precio).toLocaleString("es-CO")} = $${Math.round(it.total).toLocaleString("es-CO")}`
    );
    return (
      `*PEDIDO — ${grupo.proveedorNombre}*\n` +
      `_La Azotea Ocean Bar · ${fechaConteo}_\n` +
      `${"—".repeat(28)}\n\n` +
      `${lineas.join("\n\n")}\n\n` +
      `${"—".repeat(28)}\n` +
      `*TOTAL: $${Math.round(grupo.total).toLocaleString("es-CO")}*`
    );
  }

  // Si tenemos el teléfono del proveedor guardado, abre WhatsApp directo con
  // esa conversación. Si no, abre el buscador de contactos de WhatsApp con
  // el mensaje ya listo, para elegir a quién mandárselo en el momento.
  function enlaceWhatsApp(texto, telefono) {
    const mensaje = encodeURIComponent(texto);
    if (telefono) {
      const soloNumeros = String(telefono).replace(/\D/g, "");
      return `https://wa.me/${soloNumeros}?text=${mensaje}`;
    }
    return `https://api.whatsapp.com/send?text=${mensaje}`;
  }

  // Carga jsPDF desde cdnjs solo cuando hace falta, para no pesar la app
  // el resto del tiempo. Reutiliza la carga si ya se hizo antes.
  let cargandoJsPDF = null;
  function asegurarJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (cargandoJsPDF) return cargandoJsPDF;
    cargandoJsPDF = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = () => (window.jspdf && window.jspdf.jsPDF) ? resolve(window.jspdf.jsPDF) : reject(new Error("jsPDF no cargó."));
      s.onerror = () => reject(new Error("No se pudo cargar la librería de PDF."));
      document.head.appendChild(s);
    });
    return cargandoJsPDF;
  }

  async function descargarPDF() {
    setError(null);
    try {
      const JsPDF = await asegurarJsPDF();
      const doc = new JsPDF();
      const anchoPagina = doc.internal.pageSize.getWidth();
      const margenIzq = 14;
      const margenDer = anchoPagina - 14;
      let y = 20;

      // Encabezado
      doc.setFontSize(18);
      doc.setFont(undefined, "bold");
      doc.setTextColor(20, 30, 40);
      doc.text("La Azotea Ocean Bar", margenIzq, y);
      y += 6;
      doc.setFontSize(11);
      doc.setFont(undefined, "normal");
      doc.setTextColor(120);
      doc.text(
        `Pedido semanal · ${fechaConteo} · Nivel ${niveles.find((n) => n.id === nivel)?.label}`,
        margenIzq,
        y
      );
      doc.setDrawColor(227, 176, 74); // dorado
      doc.setLineWidth(0.8);
      y += 4;
      doc.line(margenIzq, y, margenDer, y);
      y += 10;

      let totalGeneral = 0;
      const anchoNombre = margenDer - margenIzq - 60;

      pedidoPorProveedor.grupos.forEach((grupo) => {
        const filaAltura = 6;
        const alturaCaja = 14 + grupo.items.length * filaAltura + 10;
        // Si la caja completa no cabe en lo que queda de la página, se
        // pasa a una nueva antes de empezar a dibujarla (evita que quede
        // cortada a la mitad).
        if (y + alturaCaja > 290) {
          doc.addPage();
          y = 20;
        }

        // Caja del proveedor con fondo suave
        doc.setFillColor(245, 247, 249);
        doc.setDrawColor(220, 225, 230);
        doc.roundedRect(margenIzq, y, margenDer - margenIzq, alturaCaja, 2, 2, "FD");

        let yCaja = y + 8;
        doc.setFontSize(12);
        doc.setFont(undefined, "bold");
        doc.setTextColor(30, 40, 50);
        doc.text(grupo.proveedorNombre, margenIzq + 4, yCaja);
        yCaja += 6;

        doc.setFontSize(8);
        doc.setFont(undefined, "bold");
        doc.setTextColor(140);
        doc.text("PRODUCTO", margenIzq + 4, yCaja);
        doc.text("CANT.", margenIzq + 4 + anchoNombre, yCaja, { align: "right" });
        doc.text("PRECIO", margenIzq + 4 + anchoNombre + 25, yCaja, { align: "right" });
        doc.text("TOTAL", margenDer - 4, yCaja, { align: "right" });
        yCaja += 3;
        doc.setDrawColor(220, 225, 230);
        doc.setLineWidth(0.3);
        doc.line(margenIzq + 4, yCaja, margenDer - 4, yCaja);
        yCaja += 4;

        doc.setFont(undefined, "normal");
        grupo.items.forEach((it) => {
          doc.setFontSize(9);
          doc.setTextColor(30);
          doc.text(String(it.nombre).slice(0, 42), margenIzq + 4, yCaja);
          doc.text(String(it.cantidad), margenIzq + 4 + anchoNombre, yCaja, { align: "right" });
          doc.text(`$${Math.round(it.precio).toLocaleString("es-CO")}`, margenIzq + 4 + anchoNombre + 25, yCaja, { align: "right" });
          doc.text(`$${Math.round(it.total).toLocaleString("es-CO")}`, margenDer - 4, yCaja, { align: "right" });
          yCaja += filaAltura;
        });

        yCaja += 1;
        doc.setDrawColor(220, 225, 230);
        doc.line(margenIzq + 4, yCaja, margenDer - 4, yCaja);
        yCaja += 6;
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.setTextColor(20, 30, 40);
        doc.text(`Subtotal: $${Math.round(grupo.total).toLocaleString("es-CO")}`, margenDer - 4, yCaja, { align: "right" });

        y += alturaCaja + 8;
        totalGeneral += grupo.total;
      });

      if (y > 265) {
        doc.addPage();
        y = 20;
      }
      doc.setDrawColor(227, 176, 74);
      doc.setLineWidth(0.8);
      doc.line(margenIzq, y, margenDer, y);
      y += 8;
      doc.setFontSize(14);
      doc.setFont(undefined, "bold");
      doc.setTextColor(20, 30, 40);
      doc.text(`TOTAL GENERAL: $${Math.round(totalGeneral).toLocaleString("es-CO")}`, margenDer, y, { align: "right" });
      y += 14;

      if (pedidoPorProveedor.sinProveedor.length > 0) {
        if (y > 265) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        doc.setTextColor(180, 95, 0);
        doc.text("Sin proveedor asignado (falta registrar precio)", margenIzq, y);
        y += 3;
        doc.setDrawColor(227, 176, 74);
        doc.setLineWidth(0.5);
        doc.line(margenIzq, y, margenDer, y);
        y += 6;

        doc.setFont(undefined, "normal");
        doc.setFontSize(9);
        doc.setTextColor(90, 60, 20);
        pedidoPorProveedor.sinProveedor.forEach((it) => {
          if (y > 285) {
            doc.addPage();
            y = 20;
          }
          doc.text(`• ${String(it.rawName).slice(0, 55)} — faltan ${it.diferencia}`, margenIzq, y);
          y += 5.5;
        });
      }

      // Se abre en una pestaña nueva en vez de forzar la descarga directa,
      // para que el visor de PDF del teléfono muestre sus propios botones
      // de compartir, imprimir o cerrar (el ícono de compartir de Safari).
      const blobUrl = doc.output("bloburl");
      window.open(blobUrl, "_blank");
    } catch (err) {
      setError("No se pudo generar el PDF. " + err.message);
    }
  }

  function textoWhatsAppSinProveedor() {
    const lineas = pedidoPorProveedor.sinProveedor.map(
      (it, i) => `${i + 1}. ${it.rawName} — faltan ${it.diferencia}`
    );
    return (
      `*Productos a pedir — sin proveedor asignado*\n` +
      `_La Azotea Ocean Bar · ${fechaConteo}_\n` +
      `${"—".repeat(28)}\n\n` +
      `${lineas.join("\n")}\n\n` +
      `_Precio pendiente de confirmar con el proveedor._`
    );
  }

  async function copiarSinProveedor() {
    try {
      await navigator.clipboard.writeText(textoWhatsAppSinProveedor());
      setCopiadoSinProveedor(true);
      setTimeout(() => setCopiadoSinProveedor(false), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona y copia el texto manualmente.");
    }
  }

  async function copiarPedido(grupo) {
    const texto = textoWhatsApp(grupo);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(grupo.proveedorId);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona y copia el texto manualmente.");
    }
  }

  // Al confirmar el pedido: 1) lo guarda en el historial de pedidos con su
  // fecha, y 2) actualiza el stock de cada producto comprado, sumando la
  // cantidad pedida a lo que ya había — dejando el inventario "completo"
  // (al nivel objetivo) y listo para trabajar hasta el próximo reporte.
  async function confirmarPedido() {
    setConfirmando(true);
    setError(null);
    try {
      const todosLosItems = [
        ...pedidoPorProveedor.grupos.flatMap((g) =>
          g.items.map((it) => ({ ...it, proveedor: g.proveedorNombre }))
        ),
      ];
      const costoTotal = pedidoPorProveedor.grupos.reduce((s, g) => s + g.total, 0);

      // Actualiza el mismo registro que ya quedó guardado como "pendiente"
      // al armar el pedido, marcándolo ahora como "confirmado".
      const resPedidos = await fetch("/api/tabla/pedidos");
      const dataPedidos = await resPedidos.json();
      const numero = pedidoId && dataPedidos.status === "ok"
        ? dataPedidos.filas.find((p) => p.id === pedidoId)?.numero
        : (dataPedidos.status === "ok" ? dataPedidos.filas.length : 0) + 1;

      await fetch("/api/tabla/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filas: [
            {
              id: pedidoId || generarUUID(),
              numero,
              fecha: fechaConteo,
              hora: nowTime(),
              nivel,
              estado: "confirmado",
              items: { ubicacion, lineas: todosLosItems },
              costo_total: costoTotal,
              inventario_id: historialId,
            },
          ],
        }),
      });

      // Actualiza el stock: suma lo comprado a lo que había, dejando el
      // inventario completo hasta el siguiente reporte.
      const stockCampo = ubicacion === "bar" ? "stock_bar" : "stock_bodega";
      const productosActualizados = todosLosItems
        .filter((it) => it.productoId)
        .map((it) => {
          const original = catalogo.find((p) => p.id === it.productoId);
          if (!original) return null;
          const stockActual = Number(original[stockCampo]) || 0;
          return {
            id: original.id,
            nombre: original.nombre,
            categoria: original.categoria,
            unidad: original.unidad,
            stockNormal: original.stock_normal,
            stockMedio: original.stock_medio,
            stockAlto: original.stock_alto,
            stockBar: stockCampo === "stock_bar" ? stockActual + it.cantidad : original.stock_bar,
            stockBodega: stockCampo === "stock_bodega" ? stockActual + it.cantidad : original.stock_bodega,
            estado: original.estado,
          };
        })
        .filter(Boolean);

      if (productosActualizados.length > 0) {
        await fetch("/api/productos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productos: productosActualizados }),
        });
      }

      setPedidoConfirmado(true);
    } catch (err) {
      setError("No se pudo confirmar el pedido. " + err.message);
    } finally {
      setConfirmando(false);
    }
  }

  const colores = {
    fondo: "linear-gradient(180deg, #0B1420 0%, #10202B 100%)",
    tarjeta: "#16232E",
    borde: "#24333F",
    texto: "#F2EFE9",
    textoSecundario: "#9FB0BA",
    acento: "#2DD4BF",
    dorado: "#E3B04B",
    alerta: "#F59E0B",
  };

  return (
    <main
      style={{
        background: colores.fondo,
        minHeight: "100vh",
        color: colores.texto,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ marginBottom: "24px" }}>
          <Link
            href="/"
            style={{ color: colores.textoSecundario, textDecoration: "none", fontSize: "14px" }}
          >
            ← Inicio
          </Link>
        </div>

        <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>
          Hacer pedido semanal
        </h1>
        <p style={{ color: colores.textoSecundario, marginBottom: "32px" }}>
          {paso === "config" && "Paso 1 de 3 — Nivel y ubicación"}
          {paso === "fotos" && "Paso 2 de 3 — Sube las fotos del inventario"}
          {paso === "revisar" && "Paso 3 de 3 — Revisa lo detectado"}
        </p>

        {/* Paso 1: nivel + ubicación */}
        {paso === "config" && (
          <div>
            <p style={{ fontWeight: 600, marginBottom: "12px" }}>Nivel de operación</p>
            <div style={{ display: "grid", gap: "10px", marginBottom: "28px" }}>
              {niveles.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setNivel(n.id)}
                  style={{
                    textAlign: "left",
                    background: colores.tarjeta,
                    border: `1px solid ${nivel === n.id ? colores.acento : colores.borde}`,
                    borderRadius: "14px",
                    padding: "16px",
                    color: colores.texto,
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: 700,
                  }}
                >
                  {n.label}
                  <div style={{ color: colores.textoSecundario, fontWeight: 400, fontSize: "13px" }}>
                    {n.detalle}
                  </div>
                </button>
              ))}
            </div>

            <p style={{ fontWeight: 600, marginBottom: "12px" }}>Ubicación</p>
            <div style={{ display: "flex", gap: "10px", marginBottom: "28px" }}>
              {ubicaciones.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setUbicacion(u.id)}
                  style={{
                    flex: 1,
                    background: colores.tarjeta,
                    border: `1px solid ${ubicacion === u.id ? colores.acento : colores.borde}`,
                    borderRadius: "14px",
                    padding: "16px",
                    color: colores.texto,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {u.label}
                </button>
              ))}
            </div>

            <p style={{ fontWeight: 600, marginBottom: "12px" }}>Fecha del conteo</p>
            <input
              type="date"
              value={fechaConteo}
              onChange={(e) => setFechaConteo(e.target.value)}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: `1px solid ${colores.borde}`,
                background: colores.tarjeta,
                color: colores.texto,
                fontSize: "16px",
                marginBottom: "28px",
              }}
            />

            <button
              onClick={() => setPaso("fotos")}
              disabled={!nivel || !ubicacion}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "12px",
                border: "none",
                background: nivel && ubicacion ? colores.dorado : colores.borde,
                color: "#0B1420",
                fontWeight: 700,
                fontSize: "16px",
                cursor: nivel && ubicacion ? "pointer" : "default",
              }}
            >
              Continuar
            </button>
          </div>
        )}

        {/* Paso 2: subir fotos */}
        {paso === "fotos" && (
          <div>
            <p style={{ marginBottom: "16px", color: colores.textoSecundario }}>
              <strong style={{ color: colores.acento }}>
                {niveles.find((n) => n.id === nivel)?.label}
              </strong>{" "}
              ·{" "}
              <strong style={{ color: colores.acento }}>
                {ubicaciones.find((u) => u.id === ubicacion)?.label}
              </strong>{" "}
              <button
                onClick={() => setPaso("config")}
                style={{
                  background: "none",
                  border: "none",
                  color: colores.textoSecundario,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                cambiar
              </button>
            </p>

            <label
              style={{
                display: "block",
                textAlign: "center",
                background: colores.tarjeta,
                border: `1px dashed ${colores.borde}`,
                borderRadius: "16px",
                padding: "32px",
                cursor: "pointer",
                marginBottom: "16px",
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={manejarSeleccionFotos}
                style={{ display: "none" }}
              />
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>📸</div>
              <div>Toca para tomar o subir fotos</div>
              <div style={{ color: colores.textoSecundario, fontSize: "13px" }}>
                Puedes subir varias a la vez
              </div>
            </label>

            {fotos.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "8px",
                  marginBottom: "16px",
                }}
              >
                {fotos.map((f, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img
                      src={f.preview}
                      alt={`Foto ${i + 1}`}
                      style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "8px" }}
                    />
                    <button
                      onClick={() => quitarFoto(i)}
                      style={{
                        position: "absolute",
                        top: "4px",
                        right: "4px",
                        background: "#0B1420",
                        color: colores.texto,
                        border: "none",
                        borderRadius: "999px",
                        width: "22px",
                        height: "22px",
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p style={{ color: "#F87171", marginBottom: "16px" }}>{error}</p>}

            <button
              onClick={interpretarConIA}
              disabled={cargando || fotos.length === 0}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "12px",
                border: "none",
                background: cargando ? colores.borde : colores.dorado,
                color: "#0B1420",
                fontWeight: 700,
                fontSize: "16px",
                cursor: cargando ? "default" : "pointer",
              }}
            >
              {cargando ? "Interpretando con IA..." : "Interpretar con IA"}
            </button>
          </div>
        )}

        {/* Paso 3: revisar items detectados */}
        {paso === "revisar" && items && (
          <div>
            {items.length === 0 && (
              <p style={{ color: colores.textoSecundario }}>
                No se detectó ningún producto en las fotos.
              </p>
            )}

            <div style={{ display: "grid", gap: "10px", marginBottom: "24px" }}>
              {items.map((it, i) => (
                <div
                  key={i}
                  style={{
                    background: colores.tarjeta,
                    border: `1px solid ${it.needsReview ? colores.alerta : colores.borde}`,
                    borderRadius: "14px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontWeight: 700 }}>{it.rawName}</span>
                    {it.needsReview && (
                      <span style={{ color: colores.alerta, fontSize: "12px", fontWeight: 700 }}>
                        Revisar
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <label style={{ flex: 1, fontSize: "13px", color: colores.textoSecundario }}>
                      Botellas cerradas
                      <input
                        type="number"
                        value={it.closedUnits ?? ""}
                        onChange={(e) => actualizarItem(i, "closedUnits", Number(e.target.value))}
                        style={{
                          display: "block",
                          width: "100%",
                          marginTop: "4px",
                          padding: "10px",
                          borderRadius: "8px",
                          border: `1px solid ${colores.borde}`,
                          background: "#0B1420",
                          color: colores.texto,
                        }}
                      />
                    </label>
                    <label style={{ flex: 1, fontSize: "13px", color: colores.textoSecundario }}>
                      Fracción abierta
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={it.openFraction ?? ""}
                        onChange={(e) => actualizarItem(i, "openFraction", Number(e.target.value))}
                        style={{
                          display: "block",
                          width: "100%",
                          marginTop: "4px",
                          padding: "10px",
                          borderRadius: "8px",
                          border: `1px solid ${colores.borde}`,
                          background: "#0B1420",
                          color: colores.texto,
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {error && <p style={{ color: "#F87171", marginBottom: "16px" }}>{error}</p>}

            <button
              onClick={compararConCatalogo}
              disabled={cargando}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "12px",
                border: "none",
                background: cargando ? colores.borde : colores.dorado,
                color: "#0B1420",
                fontWeight: 700,
                fontSize: "16px",
                cursor: cargando ? "default" : "pointer",
              }}
            >
              {cargando ? "Comparando..." : "Comparar con catálogo"}
            </button>
          </div>
        )}

        {/* Paso 4: comparar contra catálogo y guardar */}
        {paso === "comparar" && comparacion && (
          <div>
            <div style={{ display: "grid", gap: "10px", marginBottom: "24px" }}>
              {comparacion.map((f, i) => (
                <div
                  key={i}
                  style={{
                    background: colores.tarjeta,
                    border: `1px solid ${f.productoId ? colores.borde : colores.alerta}`,
                    borderRadius: "14px",
                    padding: "16px",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: "8px" }}>{f.rawName}</div>

                  {!f.productoId && (
                    <div style={{ marginBottom: "8px" }}>
                      <span style={{ color: colores.alerta, fontSize: "12px", fontWeight: 700 }}>
                        No coincide con ningún producto del catálogo
                      </span>
                      <select
                        onChange={(e) => asignarProducto(i, e.target.value || null)}
                        defaultValue=""
                        style={{
                          display: "block",
                          width: "100%",
                          marginTop: "6px",
                          padding: "10px",
                          borderRadius: "8px",
                          border: `1px solid ${colores.borde}`,
                          background: "#0B1420",
                          color: colores.texto,
                        }}
                      >
                        <option value="">Elegir producto manualmente...</option>
                        {catalogo.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {f.productoId && (
                    <>
                      <div style={{ display: "flex", gap: "16px", fontSize: "14px", color: colores.textoSecundario }}>
                        <span>Detectado: <strong style={{ color: colores.texto }}>{f.cantidadDetectada}</strong></span>
                        <span>Objetivo: <strong style={{ color: colores.texto }}>{f.objetivo}</strong></span>
                        <span>Falta: <strong style={{ color: colores.dorado }}>{f.diferencia}</strong></span>
                      </div>
                      {f.openFraction > 0 && (
                        <p style={{ color: colores.acento, fontSize: "12px", marginTop: "6px" }}>
                          🍾 Se registrará una botella abierta en Barra ({Math.round(f.openFraction * 12)}/12)
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {error && <p style={{ color: "#F87171", marginBottom: "16px" }}>{error}</p>}

            {guardado ? (
              <p style={{ color: colores.acento, fontWeight: 700 }}>
                ✓ Conteo guardado en {ubicaciones.find((u) => u.id === ubicacion)?.label}.
              </p>
            ) : (
              <button
                onClick={guardarConteo}
                disabled={guardando}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "none",
                  background: guardando ? colores.borde : colores.dorado,
                  color: "#0B1420",
                  fontWeight: 700,
                  fontSize: "16px",
                  cursor: guardando ? "default" : "pointer",
                }}
              >
                {guardando ? "Guardando..." : "Guardar conteo"}
              </button>
            )}
          </div>
        )}

        {/* Paso 5: pedido separado por proveedor, listo para copiar a WhatsApp */}
        {paso === "resumen" && pedidoPorProveedor && (
          <div>
            <p style={{ color: colores.textoSecundario, marginBottom: "16px" }}>
              Pedido agrupado por el proveedor más barato registrado para cada producto.
            </p>
            <p style={{ color: colores.acento, fontSize: "13px", marginBottom: "16px" }}>
              ✓ Ya quedó guardado como "Pendiente" en el Historial — puedes confirmarlo ahora
              o más tarde, cuando llegue la compra.
            </p>

            {pedidoPorProveedor.grupos.length > 0 && (
              <button
                onClick={descargarPDF}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: `1px solid ${colores.dorado}`,
                  background: "none",
                  color: colores.dorado,
                  fontWeight: 700,
                  cursor: "pointer",
                  marginBottom: "20px",
                }}
              >
                📄 Descargar PDF completo (para compras)
              </button>
            )}

            {pedidoPorProveedor.grupos.length === 0 && (
              <p style={{ color: colores.textoSecundario, marginBottom: "16px" }}>
                No hay productos con proveedor y precio registrados para comprar.
              </p>
            )}

            <div style={{ display: "grid", gap: "14px", marginBottom: "20px" }}>
              {pedidoPorProveedor.grupos.map((grupo) => (
                <div
                  key={grupo.proveedorId}
                  style={{
                    background: colores.tarjeta,
                    border: `1px solid ${colores.borde}`,
                    borderRadius: "14px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <span style={{ fontWeight: 700 }}>{grupo.proveedorNombre}</span>
                    <span style={{ color: colores.dorado, fontWeight: 700 }}>
                      ${Math.round(grupo.total).toLocaleString("es-CO")}
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: "4px", marginBottom: "12px" }}>
                    {grupo.items.map((it, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: colores.textoSecundario }}>
                        <span>{it.nombre} × {it.cantidad}</span>
                        <span>${Math.round(it.total).toLocaleString("es-CO")}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => copiarPedido(grupo)}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "10px",
                        border: `1px solid ${colores.acento}`,
                        background: copiado === grupo.proveedorId ? colores.acento : "none",
                        color: copiado === grupo.proveedorId ? "#0B1420" : colores.acento,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      {copiado === grupo.proveedorId ? "✓ Copiado" : "Copiar"}
                    </button>
                    <a
                      href={enlaceWhatsApp(textoWhatsApp(grupo), grupo.telefono)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#25D366",
                        color: "#0B1420",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: "13px",
                        textAlign: "center",
                        textDecoration: "none",
                        display: "block",
                      }}
                    >
                      📱 {grupo.telefono ? "Enviar a " + grupo.proveedorNombre : "Enviar por WhatsApp"}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {pedidoPorProveedor.sinProveedor.length > 0 && (
              <div
                style={{
                  background: colores.tarjeta,
                  border: `1px solid ${colores.alerta}`,
                  borderRadius: "14px",
                  padding: "16px",
                }}
              >
                <p style={{ color: colores.alerta, fontWeight: 700, fontSize: "13px", marginBottom: "8px" }}>
                  Sin proveedor con precio registrado
                </p>
                {pedidoPorProveedor.sinProveedor.map((it, i) => (
                  <div key={i} style={{ fontSize: "13px", color: colores.textoSecundario }}>
                    {it.rawName} — faltan {it.diferencia}
                  </div>
                ))}
                <p style={{ color: colores.textoSecundario, fontSize: "12px", margin: "8px 0" }}>
                  No tienen precio registrado todavía, pero igual quedan incluidos en el PDF
                  y los puedes copiar aquí para preguntarle el precio a cualquier proveedor
                  por WhatsApp. Luego ve a Proveedores y registra su precio para que la
                  próxima vez se agrupen solos.
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={copiarSinProveedor}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "10px",
                      border: `1px solid ${colores.alerta}`,
                      background: copiadoSinProveedor ? colores.alerta : "none",
                      color: copiadoSinProveedor ? "#0B1420" : colores.alerta,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    {copiadoSinProveedor ? "✓ Copiado" : "Copiar"}
                  </button>
                  <a
                    href={enlaceWhatsApp(textoWhatsAppSinProveedor(), null)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#25D366",
                      color: "#0B1420",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "13px",
                      textAlign: "center",
                      textDecoration: "none",
                      display: "block",
                    }}
                  >
                    📱 Enviar por WhatsApp
                  </a>
                </div>
              </div>
            )}

            {pedidoPorProveedor.grupos.length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <Link
                  href="/pedidos-anteriores"
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "none",
                    background: colores.dorado,
                    color: "#0B1420",
                    fontWeight: 700,
                    fontSize: "16px",
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  Ver pedido en Historial →
                </Link>
                <p style={{ color: colores.textoSecundario, fontSize: "12px", marginTop: "8px", textAlign: "center" }}>
                  Desde ahí lo confirmas como comprado cuando llegue la mercancía.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
