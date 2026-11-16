/* =====================================================================================
   LECTURA DE FORMATO DESDE UNA CAPTURA (Affinity, interfaz en español; inglés como respaldo)
   Lee: unidad del documento, PPP, ancho y alto de página.
   ===================================================================================== */

// --- MÓDULO 1: INTERPRETACIÓN DEL TEXTO (función pura, se prueba en Node) -----------------------
const PALABRAS_UNIDAD = {
  puntos: 'pt', punto: 'pt', points: 'pt', milimetros: 'mm', millimeters: 'mm',
  centimetros: 'cm', centimeters: 'cm', pulgadas: 'in', inches: 'in', pixeles: 'px', pixels: 'px'
};

function normalizarTexto(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');   // sin tildes
}

// Busca "595.3 pt" o "595,3" después de la etiqueta
function leerMedida(resto) {
  const m = resto.match(/(\d+(?:[.,]\d+)?)\s*(pt|mm|cm|px|in)?\b/);
  return m ? { valor: parseFloat(m[1].replace(',', '.')), unidad: m[2] } : null;
}

const SOLO_MEDIDA = /^\W*\d+(?:[.,]\d+)?\s*(pt|mm|cm|px|in)?\W*$/;   // línea que es solo "595.3 pt"

function interpretarFormato(texto) {
  const lineas = normalizarTexto(texto).split('\n');
  let unidadDocumento, ppp, ancho, alto;
  const medidas = [];            // Todas las "número + unidad" en orden, por si el OCR pierde una etiqueta
  const deducidos = [];

  lineas.forEach((linea, i) => {
    let m;
    // Valor en la misma línea o, si el OCR lo separó, en la línea siguiente cuando esta es solo una medida
    const valorDe = resto => leerMedida(resto) || (SOLO_MEDIDA.test(lineas[i + 1] || '') ? leerMedida(lineas[i + 1]) : null);

    if ((m = linea.match(/unidades? de documento|document units?/))) {
      const palabra = Object.keys(PALABRAS_UNIDAD).find(p => linea.includes(p));
      if (palabra) unidadDocumento = PALABRAS_UNIDAD[palabra];
      return;
    }
    if ((m = linea.match(/\b(ppp|dpi)\b/))) {
      const med = valorDe(linea.slice(m.index + m[0].length));
      if (med && med.valor >= 1 && med.valor <= 9999) ppp = med.valor;
      return;
    }
    for (const c of linea.matchAll(/(\d+(?:[.,]\d+)?)\s*(pt|mm|cm|px|in)\b/g)) {
      medidas.push({ valor: parseFloat(c[1].replace(',', '.')), unidad: c[2] });
    }
    // Las etiquetas toleran errores típicos del OCR ("Aliura", "Anchora")
    if ((m = linea.match(/anchura|ancho|width|\banc\w{1,3}ra\b/))) ancho = valorDe(linea.slice(m.index + m[0].length));
    else if ((m = linea.match(/altura|\balto\b|height|\bal\w{1,3}ra\b/))) alto = valorDe(linea.slice(m.index + m[0].length));
  });

  // Respaldo: Affinity siempre muestra primero el ancho y después el alto
  const pos = med => med ? medidas.findIndex(x => x.valor === med.valor && x.unidad === med.unidad) : -1;
  if (!alto) { const i = pos(ancho); alto = ancho ? medidas[i >= 0 ? i + 1 : 1] : medidas[1]; if (alto) deducidos.push('alto'); }
  if (!ancho) { const i = pos(alto); ancho = i > 0 ? medidas[i - 1] : medidas[0]; if (ancho) deducidos.push('ancho'); }

  const unidad = (ancho && ancho.unidad) || (alto && alto.unidad) || unidadDocumento;
  return { ancho: ancho && ancho.valor, alto: alto && alto.valor, unidad, ppp, deducidos };
}

if (typeof module !== 'undefined') module.exports = { interpretarFormato };

// --- MÓDULO 2: PREPARAR LA IMAGEN PARA EL OCR ----------------------------------------------------
// Las capturas de Affinity son de fondo oscuro: se agranda, pasa a grises y se invierte si hace falta.
function prepararImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      const borde = 60;   // El OCR suele perder el texto pegado al borde de la imagen (como la última fila)
      const lienzoTemp = document.createElement('canvas');
      lienzoTemp.width = imagen.width * 2 + borde * 2; lienzoTemp.height = imagen.height * 2 + borde * 2;
      const ctx = lienzoTemp.getContext('2d');
      // El borde se rellena con el color de la esquina de la captura, para que no parezca texto
      const muestra = document.createElement('canvas'); muestra.width = muestra.height = 1;
      const ctxMuestra = muestra.getContext('2d');
      ctxMuestra.drawImage(imagen, 0, 0, 1, 1, 0, 0, 1, 1);
      const [rojo, verde, azul] = ctxMuestra.getImageData(0, 0, 1, 1).data;
      ctx.fillStyle = `rgb(${rojo},${verde},${azul})`;
      ctx.fillRect(0, 0, lienzoTemp.width, lienzoTemp.height);
      ctx.drawImage(imagen, borde, borde, imagen.width * 2, imagen.height * 2);
      const datos = ctx.getImageData(0, 0, lienzoTemp.width, lienzoTemp.height);
      const p = datos.data;
      let suma = 0;
      for (let i = 0; i < p.length; i += 4) {
        const gris = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
        p[i] = p[i + 1] = p[i + 2] = gris; suma += gris;
      }
      if (suma / (p.length / 4) < 128) {
        for (let i = 0; i < p.length; i += 4) p[i] = p[i + 1] = p[i + 2] = 255 - p[i];
      }
      ctx.putImageData(datos, 0, 0);
      URL.revokeObjectURL(url);
      resolver(lienzoTemp);
    };
    imagen.onerror = () => rechazar(new Error('no se pudo abrir la imagen'));
    imagen.src = url;
  });
}

// --- MÓDULO 3: MOTOR DE OCR (Tesseract.js, se descarga la primera vez) ---------------------------
function cargarTesseract() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    script.onload = resolver;
    script.onerror = () => rechazar(new Error('sin conexión para descargar el lector'));
    document.head.appendChild(script);
  });
}

// --- MÓDULO 4: INTERFAZ (pegar, arrastrar o elegir archivo) --------------------------------------
if (typeof document !== 'undefined') {
  const estado = document.getElementById('estado-captura');
  const entradaArchivo = document.getElementById('archivo-captura');

  function aplicarFormatoLeido(f, textoLeido) {
    document.getElementById('texto-leido').textContent = textoLeido;
    const cargados = [], faltan = [];
    if (f.ancho > 0) proyecto.ancho = f.ancho; else faltan.push('ancho');
    if (f.alto > 0) proyecto.alto = f.alto; else faltan.push('alto');
    if (f.unidad) proyecto.unidad = f.unidad; else faltan.push('unidad');
    if (f.ppp) proyecto.ppp = f.ppp; else faltan.push('resolución');
    guardarProyecto(proyecto);
    ponerEnFormulario();
    mostrarResultados();
    cargados.push(`${proyecto.ancho} × ${proyecto.alto} ${proyecto.unidad} a ${proyecto.ppp} ppp`);
    estado.textContent = `Cargado: ${cargados[0]}. Revisá que coincida con tu programa.` +
      (faltan.length ? ` No pude leer: ${faltan.join(', ')}.` : '') +
      (f.deducidos.length ? ` Deducido por posición: ${f.deducidos.join(', ')}.` : '');
  }

  async function leerCaptura(archivo) {
    if (!archivo || !archivo.type.startsWith('image/')) return;
    abrirTarjeta('formato');
    estado.textContent = 'Leyendo la captura…';
    try {
      await cargarTesseract();
      const imagen = await prepararImagen(archivo);
      const { data } = await Tesseract.recognize(imagen, 'spa');
      aplicarFormatoLeido(interpretarFormato(data.text), data.text);
    } catch (e) {
      estado.textContent = `No pude leer la captura (${e.message}). La primera vez necesita conexión a internet.`;
    }
  }

  document.addEventListener('paste', e => leerCaptura([...e.clipboardData.files][0]));
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => { e.preventDefault(); leerCaptura(e.dataTransfer.files[0]); });
  document.getElementById('boton-captura').addEventListener('click', () => entradaArchivo.click());
  entradaArchivo.addEventListener('change', () => leerCaptura(entradaArchivo.files[0]));
}
