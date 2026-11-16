/* =====================================================================================
   PANTALLA 2: VISUALIZADOR
   Dibuja en SVG la página con los datos guardados en la calculadora.
   El dibujo usa puntos como unidad: el SVG escala solo, sin perder nitidez.
   ===================================================================================== */

// --- MÓDULO 1: REFERENCIAS A LA PÁGINA ------------------------------------------------------
const lienzo = document.getElementById('lienzo');
const cajaMensajes = document.getElementById('mensajes');
const capas = ['lineas', 'margenes', 'columnas', 'modulos'];
const proyecto = cargarProyecto();

// --- MÓDULO 2: CAPAS DEL DIBUJO ---------------------------------------------------------------
// Cada función devuelve un trozo de SVG. Todas reciben la misma "geometría" ya calculada.

function dibujarModulos(g) {
  let svg = '';
  for (let fila = 0; fila < g.filas; fila++) {
    const lineaInicial = fila * (g.lineasPorModulo + g.lineasMedianil);
    const y = g.arriba + lineaInicial * g.interlineado;
    for (let col = 0; col < g.columnas; col++) {
      const x = g.izquierda + col * (g.anchoColumna + g.medianil);
      svg += `<rect x="${x}" y="${y}" width="${g.anchoColumna}" height="${g.lineasPorModulo * g.interlineado}"
                    style="fill:var(--amarillo);fill-opacity:.22"/>`;
    }
  }
  return svg;
}

function dibujarColumnas(g) {
  let svg = '';
  for (let col = 0; col < g.columnas; col++) {
    const x = g.izquierda + col * (g.anchoColumna + g.medianil);
    svg += `<rect x="${x}" y="${g.arriba}" width="${g.anchoColumna}" height="${g.alturaCaja}"
                  style="fill:none;stroke:var(--tinta-suave);stroke-width:1;vector-effect:non-scaling-stroke"/>`;
  }
  return svg;
}

function dibujarLineas(g) {
  let svg = '';
  for (let i = 0; i <= g.lineasCaja; i++) {
    const y = g.arriba + i * g.interlineado;
    svg += `<line x1="${g.izquierda}" x2="${g.izquierda + g.anchoUtil}" y1="${y}" y2="${y}"
                  style="stroke:var(--cian);stroke-width:1;vector-effect:non-scaling-stroke"/>`;
  }
  return svg;
}

function dibujarMargenes(g) {
  return `<rect x="${g.izquierda}" y="${g.arriba}" width="${g.anchoUtil}" height="${g.alturaCaja}"
                style="fill:none;stroke:var(--magenta);stroke-width:1.5;vector-effect:non-scaling-stroke"/>`;
}

// --- MÓDULO 3: ARMAR EL DIBUJO COMPLETO ---------------------------------------------------------
function dibujar() {
  if (['interlineado', 'rapido'].includes(proyecto.objetivo)) {
    cajaMensajes.innerHTML = '';
    lienzo.innerHTML = '<p class="mensaje aviso">Este objetivo solo propone opciones: no genera una grilla para dibujar. Elegí una y pasá a "Obtener los márgenes" para verla.</p>';
    return;
  }
  const { vertical, horizontal, medidas } = resolverProyecto(proyecto);
  const errores = [...vertical.errores, ...horizontal.errores];
  cajaMensajes.innerHTML = [...errores.map(t => [t, 'error']), ...[...vertical.avisos, ...horizontal.avisos].map(t => [t, 'aviso'])]
    .map(([t, clase]) => `<p class="mensaje ${clase}">${t}</p>`).join('');

  if (!vertical.ok || !horizontal.ok) {
    lienzo.innerHTML = '<p class="mensaje error">Corregí los datos en la calculadora para ver la grilla.</p>';
    return;
  }
  const g = {
    izquierda: medidas.margenIzquierdo, arriba: vertical.resultado.margenSuperior,
    anchoUtil: horizontal.resultado.anchoUtil, anchoColumna: horizontal.resultado.anchoColumna,
    alturaCaja: vertical.resultado.alturaCaja, lineasCaja: vertical.resultado.lineasCaja,
    interlineado: medidas.interlineado, medianil: medidas.medianil, columnas: proyecto.columnas,
    filas: proyecto.filas, lineasPorModulo: proyecto.lineasPorModulo, lineasMedianil: proyecto.lineasMedianil
  };
  const activa = nombre => document.getElementById('ver-' + nombre).checked;

  lienzo.innerHTML = `
    <svg viewBox="0 0 ${medidas.ancho} ${medidas.alto}" role="img" aria-label="Vista previa de la grilla">
      ${activa('modulos') ? dibujarModulos(g) : ''}
      ${activa('columnas') ? dibujarColumnas(g) : ''}
      ${activa('lineas') ? dibujarLineas(g) : ''}
      ${activa('margenes') ? dibujarMargenes(g) : ''}
    </svg>`;
}

// --- MÓDULO 4: EVENTOS E INICIO -------------------------------------------------------------------
capas.forEach(nombre => document.getElementById('ver-' + nombre).addEventListener('change', dibujar));
dibujar();
