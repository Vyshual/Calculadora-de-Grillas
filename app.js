/* =====================================================================================
   APLICACIÓN: un solo espacio de trabajo (datos · vista previa · resultados)
   Usa el núcleo (nucleo.js) y el estado (estado.js). No calcula nada por su cuenta.
   ===================================================================================== */

// --- MÓDULO 1: REFERENCIAS Y ESTADO DE LA PANTALLA ----------------------------------------------
const $ = id => document.getElementById(id);
const formulario = $('formulario'), lienzo = $('lienzo'), cajaMensajes = $('mensajes'), listaDatos = $('datos');
const listaOpciones = $('opciones'), insignia = $('insignia'), notaSugerencia = $('nota-sugerencia'), esquema = $('esquema');
const tarjetas = [...formulario.querySelectorAll('details.tarjeta')];   // solo las del formulario de la grilla
const esCelular = matchMedia('(max-width: 699px)');
let proyecto = cargarProyecto();
let filasActuales = [];          // Últimos resultados mostrados (los usa la exportación)
let opcionesActuales = [];       // Opciones de las listas ("Usar ›")
let ultimoDibujo = null;         // Último resultado dibujable (para re-dibujar al cambiar capas)
const capas = { lineas: true, pequena: true, margenes: true, columnas: true, modulos: true };

// --- MÓDULO 2: OBJETIVOS, FORMATOS FRECUENTES Y RESÚMENES ------------------------------------------
const OBJETIVOS = {
  margenes: { descripcion: 'Das el formato, la grilla y las columnas: la app calcula los cuatro márgenes.', pasos: ['formato', 'grilla', 'columnas'] },
  rapido: { descripcion: 'Solo el alto, el interlineado y la cantidad de módulos: la app propone márgenes posibles.', pasos: ['formato', 'grilla'] },
  interlineado: { descripcion: 'Das el alto y el margen que querés: la app lista interlineados que cierran.', pasos: ['formato', 'grilla'] },
  verificar: { descripcion: 'Ya tenés todos los valores: la app verifica que cierren.', pasos: ['formato', 'grilla', 'margenes', 'columnas'] }
};
if (!OBJETIVOS[proyecto.objetivo]) proyecto.objetivo = 'margenes';

const FORMATOS = [
  { nombre: 'A4', unidad: 'pt', ancho: 595.28, alto: 841.89, ppp: 300 }, { nombre: 'A5', unidad: 'pt', ancho: 419.53, alto: 595.28, ppp: 300 },
  { nombre: 'Carta', unidad: 'pt', ancho: 612, alto: 792, ppp: 300 }, { nombre: '1080 × 1080', unidad: 'px', ancho: 1080, alto: 1080, ppp: 72 },
  { nombre: '1080 × 1350', unidad: 'px', ancho: 1080, alto: 1350, ppp: 72 }, { nombre: 'Historia 1080 × 1920', unidad: 'px', ancho: 1080, alto: 1920, ppp: 72 },
  { nombre: '1920 × 1080', unidad: 'px', ancho: 1920, alto: 1080, ppp: 72 }
];

const r2 = v => Grilla.redondear(v, 2);
const RESUMENES = {
  formato: p => `${r2(p.ancho)} × ${r2(p.alto)} ${p.unidad} · ${r2(p.ppp)} ppp`,
  grilla: p => p.objetivo === 'interlineado' ? `margen deseado ${r2(p.margenDeseado)} ${p.unidad}`
    : `${r2(p.interlineado)} ${p.unidadInterlineado} · ${p.filas} ${p.filas === 1 ? 'módulo' : 'módulos'}` +
      (['margenes', 'verificar'].includes(p.objetivo) ? ` × ${p.lineasPorModulo} líneas` : ''),
  margenes: p => `${r2(p.margenSuperior)} / ${r2(p.margenInferior)} / ${r2(p.margenIzquierdo)} / ${r2(p.margenDerecho)} ${p.unidad}`,
  columnas: p => `${p.columnas} ${p.columnas === 1 ? 'columna' : 'columnas'} · medianil ${r2(p.medianil)} ${p.unidad}`
};

// --- MÓDULO 3: FORMULARIO <-> PROYECTO -----------------------------------------------------------------
function ponerEnFormulario() {
  for (const campo of formulario.elements) if (campo.name) campo.value = proyecto[campo.name];
}
function leerCampo(campo) {
  proyecto[campo.name] = (campo.type === 'number' || 'numerico' in campo.dataset) ? parseFloat(campo.value) || 0 : campo.value;
}

// --- MÓDULO 4: AYUDAS DE FORMATO -------------------------------------------------------------------------
const aTexto = puntos => `${r2(Grilla.dePuntos(puntos, proyecto.unidad, proyecto.ppp))} ${proyecto.unidad}`;
const mensaje = (tipo, texto) => `<p class="mensaje ${tipo}"><span>${texto}</span></p>`;
const filaDato = (nombre, valor) => `<dt>${nombre}</dt><dd>${valor}</dd>`;

function pintarEstado(errores, avisos) {
  const tipo = errores.length ? 'error' : avisos.length ? 'aviso' : 'ok';
  insignia.className = `insignia ${tipo}`;
  insignia.textContent = { ok: 'Todo en orden', aviso: 'Con avisos', error: 'Hay errores' }[tipo];
  cajaMensajes.innerHTML = errores.map(t => mensaje('error', t)).join('') + avisos.map(t => mensaje('aviso', t)).join('');
}

// --- MÓDULO 5: RESULTADOS (calcula según el objetivo y actualiza todo) --------------------------------------
function mostrarResultados() {
  const objetivo = proyecto.objetivo, filas = [], opciones = [];
  let errores = [], avisos = [], dibujo = null;

  if (objetivo === 'interlineado') {
    const u = proyecto.unidadInterlineado, lista = resolverBusqueda(proyecto);
    if (!(proyecto.ppp > 0)) errores.push('La resolución (ppp) tiene que ser mayor que 0.');
    else if (!lista.length) avisos.push('Con ese alto y ese margen no entra ninguna caja de texto. Probá con un margen menor.');
    if (lista.length && !lista.some(g => g.exacta)) avisos.push('Ningún interlineado entero cierra exacto con este alto: los márgenes son aproximados.');
    lista.forEach(g => opciones.push({ titulo: `${g.interlineado} ${u}`, detalle: `${g.lineasCaja} líneas · margen ${g.exacta ? '' : '≈ '}${r2(g.margenReal)} ${u}`,
      aplicar: () => Object.assign(proyecto, { interlineado: g.interlineado, filas: 1, lineasPorModulo: g.lineasCaja, lineasMedianil: 0 }) }));
  } else if (objetivo === 'rapido') {
    const r = resolverRapido(proyecto);
    errores = r.errores.slice();
    if (r.ok && !r.opciones.length) avisos.push('Con ese interlineado y esa cantidad de módulos no queda espacio para márgenes.');
    if (r.ok && !r.exacto && r.sugerencia) avisos.push(`El alto no es múltiplo exacto del interlineado, así que los márgenes son aproximados. Con un interlineado de ${r2(Grilla.dePuntos(r.sugerencia.interlineado, proyecto.unidadInterlineado, proyecto.ppp))} ${proyecto.unidadInterlineado} la grilla cierra exacta.`);
    r.opciones.slice(0, 12).forEach(o => opciones.push({ titulo: `${o.lineasPorModulo} líneas por módulo`,
      detalle: o.simetrico ? `margen ${r.exacto ? '' : '≈ '}${aTexto(o.margenSuperior)}` : `${aTexto(o.margenSuperior)} arriba · ${aTexto(o.margenInferior)} abajo`,
      aplicar: () => Object.assign(proyecto, { lineasPorModulo: o.lineasPorModulo, lineasMedianil: 1 }) }));
  } else {
    const res = resolverProyecto(proyecto), { vertical, horizontal, medidas } = res;
    errores = [...vertical.errores, ...horizontal.errores];
    avisos = [...vertical.avisos, ...horizontal.avisos];
    dibujo = res;
    if (vertical.ok) filas.push(['Margen superior', aTexto(vertical.resultado.margenSuperior)], ['Margen inferior', aTexto(vertical.resultado.margenInferior)]);
    if (horizontal.ok) filas.push(['Margen izquierdo', aTexto(medidas.margenIzquierdo)], ['Margen derecho', aTexto(medidas.margenDerecho)]);
    if (vertical.ok) {
      const v = vertical.resultado;
      filas.push(['Líneas en la página', r2(v.lineasPagina)], ['Líneas de la caja', v.lineasCaja], ['Altura de la caja', aTexto(v.alturaCaja)]);
      if (v.sobrante > 1e-6) filas.push(['Espacio sobrante', aTexto(v.sobrante)]);
      if (proyecto.modoMargenes === 'clasico') filas.push(['Márgenes en líneas', `${r2(v.lineasMargenSuperior)} / ${r2(v.lineasMargenInferior)}`]);
    }
    if (vertical.ok && Number(proyecto.subdivision) > 1) filas.push(['Grilla pequeña', `${r2(proyecto.interlineado / proyecto.subdivision)} ${proyecto.unidadInterlineado}`]);
    if (horizontal.ok) filas.push(['Ancho útil', aTexto(horizontal.resultado.anchoUtil)], ['Ancho de columna', aTexto(horizontal.resultado.anchoColumna)]);
  }

  pintarEstado(errores, avisos);
  listaDatos.innerHTML = filas.map(([n, v]) => filaDato(n, v)).join('');
  listaOpciones.innerHTML = opciones.map((o, i) => `<li><button type="button" class="opcion" data-opcion="${i}"><span><strong>${o.titulo}</strong><small>${o.detalle}</small></span></button></li>`).join('');
  opcionesActuales = opciones;
  filasActuales = filas.length ? filas : opciones.map(o => [o.titulo, o.detalle]);
  pintarEsquema(dibujo);
  dibujarVista(dibujo);
  formulario.margenSuperior.disabled = formulario.margenInferior.disabled = proyecto.modoMargenes === 'clasico';
  document.querySelectorAll('[data-resumen]').forEach(e => e.textContent = RESUMENES[e.dataset.resumen](proyecto));
}

function pintarEsquema(res) {
  esquema.hidden = !(res && res.vertical.ok && res.horizontal.ok);
  if (esquema.hidden) return;
  const celda = (clase, nombre, valor) => `<div class="m ${clase}"><span>${nombre}</span><strong>${aTexto(valor)}</strong></div>`;
  esquema.innerHTML = celda('sup', 'Superior', res.vertical.resultado.margenSuperior) + celda('izq', 'Izquierdo', res.medidas.margenIzquierdo) +
    '<div class="pagina">página</div>' + celda('der', 'Derecho', res.medidas.margenDerecho) + celda('inf', 'Inferior', res.vertical.resultado.margenInferior);
}

// --- MÓDULO 6: VISTA PREVIA (SVG en puntos: escala sola, sin perder nitidez) --------------------------------------
function dibujarVista(res) {
  ultimoDibujo = res;
  if (!res) { lienzo.innerHTML = '<p class="vacio">Elegí una opción de la lista de resultados y la verás dibujada acá.</p>'; return; }
  if (!res.vertical.ok || !res.horizontal.ok) { lienzo.innerHTML = '<p class="vacio">Corregí los datos para ver la grilla.</p>'; return; }
  const v = res.vertical.resultado, h = res.horizontal.resultado, m = res.medidas;
  const x0 = m.margenIzquierdo, y0 = v.margenSuperior, p = proyecto, fs = Math.max(m.ancho, m.alto) / 42;
  const trazo = (color, grosor) => `fill:none;stroke:var(${color});stroke-width:${grosor};vector-effect:non-scaling-stroke`;
  let svg = `<rect width="${m.ancho}" height="${m.alto}" style="fill:var(--hoja)"/>`;
  if (capas.modulos) for (let f = 0; f < p.filas; f++) for (let c = 0; c < p.columnas; c++) {
    svg += `<rect x="${x0 + c * (h.anchoColumna + m.medianil)}" y="${y0 + f * (p.lineasPorModulo + p.lineasMedianil) * m.interlineado}" width="${h.anchoColumna}" height="${p.lineasPorModulo * m.interlineado}" style="fill:var(--amarillo);fill-opacity:.22"/>`;
  }
  if (capas.columnas) for (let c = 0; c < p.columnas; c++) svg += `<rect x="${x0 + c * (h.anchoColumna + m.medianil)}" y="${y0}" width="${h.anchoColumna}" height="${v.alturaCaja}" style="${trazo('--tinta-suave', 1)}"/>`;
  const sub = Math.max(1, Math.round(Number(p.subdivision) || 1));      // grilla pequeña: líneas punteadas entre las principales
  if (capas.pequena && sub > 1) for (let i = 0; i <= v.lineasCaja * sub; i++) if (i % sub) svg += `<line x1="${x0}" x2="${x0 + h.anchoUtil}" y1="${y0 + i * m.interlineado / sub}" y2="${y0 + i * m.interlineado / sub}" style="${trazo('--cian', 1)};stroke-dasharray:3 3;opacity:.55"/>`;
  if (capas.lineas) for (let i = 0; i <= v.lineasCaja; i++) svg += `<line x1="${x0}" x2="${x0 + h.anchoUtil}" y1="${y0 + i * m.interlineado}" y2="${y0 + i * m.interlineado}" style="${trazo('--cian', 1)}"/>`;
  if (capas.margenes) {
    svg += `<rect x="${x0}" y="${y0}" width="${h.anchoUtil}" height="${v.alturaCaja}" style="${trazo('--magenta', 2)}"/>`;
    // Los laterales van girados para que quepan en márgenes angostos
    const etiqueta = (x, y, valor, cabe, giro) => cabe ? `<text x="${x}" y="${y}"${giro ? ` transform="rotate(-90 ${x} ${y})"` : ''} text-anchor="middle" dominant-baseline="middle" style="fill:var(--magenta);font:700 ${fs}px system-ui">${r2(Grilla.dePuntos(valor, p.unidad, p.ppp))}</text>` : '';
    svg += etiqueta(m.ancho / 2, y0 / 2, v.margenSuperior, y0 > fs * 1.6) + etiqueta(m.ancho / 2, m.alto - v.margenInferior / 2, v.margenInferior, v.margenInferior > fs * 1.6) +
      etiqueta(x0 / 2, m.alto / 2, m.margenIzquierdo, x0 > fs * 1.6, true) + etiqueta(m.ancho - m.margenDerecho / 2, m.alto / 2, m.margenDerecho, m.margenDerecho > fs * 1.6, true);
  }
  svg += `<rect width="${m.ancho}" height="${m.alto}" style="${trazo('--linea', 1)}"/>`;
  lienzo.innerHTML = `<svg viewBox="0 0 ${m.ancho} ${m.alto}" role="img" aria-label="Vista previa de la página con su grilla">${svg}</svg>`;
}

// --- MÓDULO 7: EXPORTACIÓN DE VALORES ---------------------------------------------------------------------------
const listaParaExportar = () => [['Formato', `${proyecto.ancho} × ${proyecto.alto} ${proyecto.unidad}`], ['Resolución', `${proyecto.ppp} ppp`],
  ['Interlineado', `${proyecto.interlineado} ${proyecto.unidadInterlineado}`], ...filasActuales];
const comoTexto = () => listaParaExportar().map(([n, v]) => `${n}: ${v}`).join('\n');
const comoCSV = () => '\ufeff' + 'Dato,Valor\n' + listaParaExportar().map(([n, v]) => `"${String(n).replace(/"/g, '""')}","${String(v).replace(/"/g, '""')}"`).join('\n');

$('boton-copiar').addEventListener('click', async e => {
  const boton = e.currentTarget;
  try { await navigator.clipboard.writeText(comoTexto()); boton.textContent = 'Copiado ✓'; } catch (err) { boton.textContent = 'No se pudo copiar'; }
  setTimeout(() => boton.textContent = 'Copiar valores', 1800);
});
$('boton-csv').addEventListener('click', () => {
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([comoCSV()], { type: 'text/csv;charset=utf-8' }));
  enlace.download = 'grilla-valores.csv'; enlace.click(); URL.revokeObjectURL(enlace.href);
});

// --- MÓDULO 8: OBJETIVO, TARJETAS Y VISTAS DEL CELULAR ---------------------------------------------------------------
function actualizarObjetivo() {
  const pasos = OBJETIVOS[proyecto.objetivo].pasos;
  document.querySelectorAll('.chip-objetivo').forEach(b => b.setAttribute('aria-pressed', b.dataset.objetivo === proyecto.objetivo));
  $('descripcion-objetivo').textContent = OBJETIVOS[proyecto.objetivo].descripcion;
  tarjetas.forEach(t => t.hidden = !pasos.includes(t.dataset.paso));
  formulario.querySelectorAll('[data-objetivos]').forEach(e => e.hidden = !e.dataset.objetivos.split(' ').includes(proyecto.objetivo));
  formulario.querySelectorAll('.fila').forEach(f => f.hidden = [...f.children].every(c => c.hidden));
  const visibles = tarjetas.filter(t => !t.hidden);
  if (!visibles.some(t => t.open)) visibles[0].open = true;
  tarjetas.forEach(t => { const b = t.querySelector('[data-siguiente]'); if (b) b.hidden = t === visibles[visibles.length - 1]; });
}
const abrirTarjeta = id => { const t = tarjetas.find(x => x.dataset.paso === id); if (t) t.open = true; };

function irAVista(nombre) {
  document.body.dataset.vista = nombre;
  document.querySelectorAll('.pestana-inferior').forEach(b => b.setAttribute('aria-current', b.dataset.ir === nombre ? 'page' : 'false'));
  window.scrollTo({ top: 0 });
}

document.querySelectorAll('.chip-objetivo').forEach(b => b.addEventListener('click', () => {
  proyecto.objetivo = b.dataset.objetivo; guardarProyecto(proyecto); notaSugerencia.innerHTML = '';
  actualizarObjetivo(); mostrarResultados();
}));
document.querySelectorAll('[data-siguiente]').forEach(b => b.addEventListener('click', () => {
  const actual = b.closest('details'), siguiente = tarjetas.slice(tarjetas.indexOf(actual) + 1).find(t => !t.hidden);
  if (!siguiente) return;
  actual.open = false; siguiente.open = true; siguiente.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}));
$('boton-abrir-todas').addEventListener('click', e => {
  const visibles = tarjetas.filter(t => !t.hidden), abrir = visibles.some(t => !t.open);
  visibles.forEach((t, i) => t.open = abrir || i === 0);
  e.currentTarget.textContent = abrir ? 'Cerrar todas' : 'Abrir todas';
});
document.querySelectorAll('.pestana-inferior').forEach(b => b.addEventListener('click', () => irAVista(b.dataset.ir)));
document.querySelectorAll('[data-capa]').forEach(b => b.addEventListener('click', () => {
  capas[b.dataset.capa] = !capas[b.dataset.capa]; b.setAttribute('aria-pressed', capas[b.dataset.capa]); dibujarVista(ultimoDibujo);
}));

// --- MÓDULO 9: ACCIONES RÁPIDAS (formatos, elegir por mí, usar opción, restablecer) ---------------------------------------
FORMATOS.forEach(f => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip'; b.textContent = f.nombre;
  b.addEventListener('click', () => {
    Object.assign(proyecto, { unidad: f.unidad, ancho: f.ancho, alto: f.alto, ppp: f.ppp });
    Object.assign(proyecto, f.unidad === 'px' ? { unidadInterlineado: 'px', interlineado: 24 } : { unidadInterlineado: 'pt', interlineado: 14 });
    guardarProyecto(proyecto); notaSugerencia.innerHTML = ''; ponerEnFormulario(); mostrarResultados();
  });
  $('chips-formato').appendChild(b);
});

$('boton-sugerir').addEventListener('click', () => {
  const s = sugerirProyecto(proyecto);
  if (!s.ok) { notaSugerencia.innerHTML = s.errores.map(t => mensaje('error', t)).join(''); if (esCelular.matches) irAVista('resultados'); return; }
  Object.assign(proyecto, s.campos);
  if (!['margenes', 'verificar'].includes(proyecto.objetivo)) proyecto.objetivo = 'margenes';   // para ver los cuatro márgenes
  guardarProyecto(proyecto); ponerEnFormulario(); actualizarObjetivo(); mostrarResultados();
  const r = s.resumen;
  notaSugerencia.innerHTML = mensaje('ok', `Elegí por vos: interlineado de ${r2(r.interlineado)} ${r.unidadInterlineado}, ` +
    `${r.filas} ${r.filas === 1 ? 'módulo' : 'módulos'} de ${r.lineasPorModulo} líneas, ${r.columnas} ${r.columnas === 1 ? 'columna' : 'columnas'} ` +
    `y márgenes de ${r2(r.margenEnPagina)} ${proyecto.unidad}. Todo cierra exacto.`);
  if (esCelular.matches) irAVista('resultados');
});

listaOpciones.addEventListener('click', e => {         // "Usar ›": carga la opción elegida y pasa a ver los cuatro márgenes
  const boton = e.target.closest('[data-opcion]');
  if (!boton) return;
  opcionesActuales[Number(boton.dataset.opcion)].aplicar();
  Object.assign(proyecto, { objetivo: 'margenes', modoMargenes: 'clasico', anchoColumna: 0 });
  guardarProyecto(proyecto); ponerEnFormulario(); actualizarObjetivo(); mostrarResultados();
});

$('boton-restablecer').addEventListener('click', () => {
  proyecto = normalizarProyecto({ objetivo: proyecto.objetivo });
  guardarProyecto(proyecto); notaSugerencia.innerHTML = ''; ponerEnFormulario(); mostrarResultados();
});

// --- MÓDULO 10: EVENTOS DEL FORMULARIO E INICIO ------------------------------------------------------------------------------
formulario.addEventListener('submit', e => e.preventDefault());
formulario.addEventListener('input', e => {
  if (!e.target.name) return;
  notaSugerencia.innerHTML = '';
  leerCampo(e.target); guardarProyecto(proyecto); mostrarResultados();
});

ponerEnFormulario();
actualizarObjetivo();
mostrarResultados();

// --- MÓDULO 11: VISOR A PANTALLA GRANDE ---------------------------------------------------------------------
const visor = $('visor'), cuerpoVisor = $('visor-cuerpo'), ZOOMS = [0, 1, 1.5, 2, 3];   // 0 = ajustar a la pantalla
let nivelZoom = 0;
function aplicarZoom() {
  const svg = cuerpoVisor.querySelector('svg'); if (!svg) return;
  Object.assign(svg.style, nivelZoom === 0 ? { height: 'calc(100dvh - 110px)', width: 'auto', maxWidth: '100%' } : { height: 'auto', maxWidth: 'none', width: `${ZOOMS[nivelZoom] * 100}%` });
}
function abrirVisor(titulo, htmlSvg) {
  $('visor-titulo').textContent = titulo; cuerpoVisor.innerHTML = htmlSvg; nivelZoom = 0; aplicarZoom();
  if (!visor.open) visor.showModal();
}
$('visor-cerrar').addEventListener('click', () => visor.close());
$('visor-ajustar').addEventListener('click', () => { nivelZoom = 0; aplicarZoom(); });
$('visor-mas').addEventListener('click', () => { nivelZoom = Math.min(ZOOMS.length - 1, nivelZoom + 1); aplicarZoom(); });
$('visor-menos').addEventListener('click', () => { nivelZoom = Math.max(0, nivelZoom - 1); aplicarZoom(); });
$('boton-ampliar').addEventListener('click', () => { const svg = lienzo.querySelector('svg'); if (svg) abrirVisor('Vista de la grilla', svg.outerHTML); });
