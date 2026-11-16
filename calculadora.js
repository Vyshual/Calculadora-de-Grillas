/* =====================================================================================
   PANTALLA 1: CALCULADORA
   Primero se elige qué obtener; después se piden solo los datos que hacen falta.
   ===================================================================================== */

// --- MÓDULO 1: REFERENCIAS A LA PÁGINA ------------------------------------------------------
const formulario = document.getElementById('formulario');
const cajaMensajes = document.getElementById('mensajes');
const listaDatos = document.getElementById('datos');
const insignia = document.getElementById('insignia');
const notaSugerencia = document.getElementById('nota-sugerencia');
const selectorObjetivo = document.getElementById('selector-objetivo');
const panelFormulario = document.querySelector('.panel-formulario');
const panelResultados = document.querySelector('.resultados');
const contenedor = document.querySelector('.calculadora');
let proyecto = cargarProyecto();
let filasActuales = [];          // Últimos resultados mostrados (los usa la exportación)

// --- MÓDULO 2: OBJETIVOS Y SUS PASOS -----------------------------------------------------------
const TITULOS_PASO = { rapido: 'Módulos', formato: 'Formato', grilla: 'Grilla base', margenes: 'Márgenes', columnas: 'Columnas', deseado: 'Margen deseado' };
const OBJETIVOS = {
  rapido: { nombre: 'Margen rápido', pasos: ['formato', 'rapido'] },
  margenes: { nombre: 'Obtener los márgenes', pasos: ['formato', 'grilla', 'columnas'] },
  interlineado: { nombre: 'Encontrar el interlineado', pasos: ['formato', 'deseado'] },
  verificar: { nombre: 'Revisar una grilla completa', pasos: ['formato', 'grilla', 'margenes', 'columnas'] }
};

// --- MÓDULO 3: FORMULARIO <-> PROYECTO ------------------------------------------------------
function ponerEnFormulario() {
  for (const campo of formulario.elements) if (campo.name) campo.value = proyecto[campo.name];
}

// Lee solo el campo tocado y copia su valor a los campos que se llaman igual (hay uno repetido)
function leerCampo(campo) {
  proyecto[campo.name] = campo.type === 'number' ? parseFloat(campo.value) || 0 : campo.value;
  for (const otro of formulario.elements) if (otro.name === campo.name && otro !== campo) otro.value = campo.value;
}

// --- MÓDULO 4: FORMATO DE LOS RESULTADOS -----------------------------------------------------
function aTexto(puntos) {
  return `${Grilla.redondear(Grilla.dePuntos(puntos, proyecto.unidad, proyecto.ppp))} ${proyecto.unidad}`;
}
const filaDato = (nombre, valor) => `<dt>${nombre}</dt><dd>${valor}</dd>`;
const mensaje = (tipo, texto) => `<p class="mensaje ${tipo}"><span>${texto}</span></p>`;

// --- MÓDULO 5: MOSTRAR RESULTADOS Y ESTADO ------------------------------------------------------
function pintarEstado(errores, avisos) {
  const tipo = errores.length ? 'error' : avisos.length ? 'aviso' : 'ok';
  insignia.className = `insignia ${tipo}`;
  insignia.textContent = { ok: 'Todo en orden', aviso: 'Con avisos', error: 'Hay errores' }[tipo];
  cajaMensajes.innerHTML = errores.map(t => mensaje('error', t)).join('') + avisos.map(t => mensaje('aviso', t)).join('');
}

function mostrarResultados() {
  const filas = [];
  let errores = [], avisos = [];

  if (proyecto.objetivo === 'interlineado') {
    const lista = resolverBusqueda(proyecto);
    if (!(proyecto.ppp > 0)) errores.push('La resolución (ppp) tiene que ser mayor que 0.');
    else if (!lista.length) avisos.push('Con ese alto y ese margen no entra ninguna caja de texto. Probá con un margen menor.');
    const u = proyecto.unidadInterlineado;
    lista.forEach(g => filas.push([`${g.interlineado} ${u}`,
      `${g.lineasCaja} líneas · margen ${g.exacta ? '' : '≈ '}${Grilla.redondear(g.margenReal)} ${u}`]));
    if (lista.length && !lista.some(g => g.exacta)) avisos.push('Ningún interlineado entero cierra exacto con este alto: los márgenes son aproximados.');
  } else if (proyecto.objetivo === 'rapido') {
    const r = resolverRapido(proyecto);
    errores = r.errores;
    if (r.ok && !r.opciones.length) avisos.push('Con ese interlineado y esa cantidad de módulos no queda espacio para márgenes.');
    if (r.ok && !r.exacto && r.sugerencia) avisos.push(`El alto no es múltiplo exacto del interlineado, así que los márgenes son aproximados. Con un interlineado de ${Grilla.redondear(Grilla.dePuntos(r.sugerencia.interlineado, proyecto.unidadInterlineado, proyecto.ppp))} ${proyecto.unidadInterlineado} la grilla cierra exacta.`);
    r.opciones.slice(0, 12).forEach(o => filas.push([`${o.lineasPorModulo} líneas por módulo`,
      o.simetrico ? `margen ${r.exacto ? '' : '≈ '}${aTexto(o.margenSuperior)}`
                  : `${aTexto(o.margenSuperior)} arriba · ${aTexto(o.margenInferior)} abajo (asimétrico)`]));
  } else {
    const { vertical, horizontal, medidas } = resolverProyecto(proyecto);
    errores = [...vertical.errores, ...horizontal.errores];
    avisos = [...vertical.avisos, ...horizontal.avisos];
    // Primero los márgenes (lo que más se busca), después el resto
    if (vertical.ok) {
      filas.push(['Margen superior', aTexto(vertical.resultado.margenSuperior)]);
      filas.push(['Margen inferior', aTexto(vertical.resultado.margenInferior)]);
    }
    if (horizontal.ok) {
      filas.push(['Margen izquierdo', aTexto(medidas.margenIzquierdo)]);
      filas.push(['Margen derecho', aTexto(medidas.margenDerecho)]);
    }
    if (vertical.ok) {
      const r = vertical.resultado;
      filas.push(['Líneas en la página', Grilla.redondear(r.lineasPagina)], ['Líneas de la caja', r.lineasCaja],
                 ['Altura de la caja', aTexto(r.alturaCaja)]);
      if (r.sobrante > 1e-6) filas.push(['Espacio sobrante', aTexto(r.sobrante)]);
      if (proyecto.modoMargenes === 'clasico') filas.push(['Márgenes en líneas', `${Grilla.redondear(r.lineasMargenSuperior)} / ${Grilla.redondear(r.lineasMargenInferior)}`]);
    }
    if (horizontal.ok) filas.push(['Ancho útil', aTexto(horizontal.resultado.anchoUtil)],
                                  ['Ancho de columna', aTexto(horizontal.resultado.anchoColumna)]);
  }
  pintarEstado(errores, avisos);
  listaDatos.innerHTML = filas.map(([n, v]) => filaDato(n, v)).join('');
  filasActuales = filas;
  // En modo clásico los márgenes verticales se calculan: no se escriben a mano
  formulario.margenSuperior.disabled = formulario.margenInferior.disabled = proyecto.modoMargenes === 'clasico';
}

// --- MÓDULO 6: EXPORTACIÓN DE VALORES ----------------------------------------------------------
function listaParaExportar() {
  const p = proyecto;
  return [['Objetivo', OBJETIVOS[p.objetivo] ? OBJETIVOS[p.objetivo].nombre : ''],
    ['Formato', `${p.ancho} × ${p.alto} ${p.unidad}`], ['Resolución', `${p.ppp} ppp`],
    ['Interlineado', `${p.interlineado} ${p.unidadInterlineado}`], ...filasActuales];
}
const comoTexto = () => listaParaExportar().map(([n, v]) => `${n}: ${v}`).join('\n');
const comoCSV = () => '\ufeff' + 'Dato,Valor\n' + listaParaExportar()
  .map(([n, v]) => `"${String(n).replace(/"/g, '""')}","${String(v).replace(/"/g, '""')}"`).join('\n');

function descargarArchivo(nombre, contenido, tipo) {
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}
const botonCopiar = document.getElementById('boton-copiar');
botonCopiar.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(comoTexto()); botonCopiar.textContent = 'Copiado'; }
  catch (e) { botonCopiar.textContent = 'No se pudo copiar'; }
  setTimeout(() => botonCopiar.textContent = 'Copiar valores', 1800);
});
document.getElementById('boton-csv').addEventListener('click', () =>
  descargarArchivo('grilla-valores.csv', comoCSV(), 'text/csv;charset=utf-8'));

// --- MÓDULO 7: OBJETIVO, PASOS Y CONFIGURACIÓN AVANZADA ---------------------------------------------
// Por pasos: un grupo a la vez. Avanzada: todos los grupos del objetivo juntos.
const grupos = [...formulario.querySelectorAll('fieldset[data-paso]')];
const contenedorPasos = document.getElementById('pasos');
const barraInferior = document.getElementById('barra-inferior');
const indicadorPaso = document.getElementById('indicador-paso');
const botonAnterior = document.getElementById('boton-anterior');
const botonSiguiente = document.getElementById('boton-siguiente');
const botonAvanzada = document.getElementById('boton-avanzada');
const CLAVE_AVANZADA = 'estudioGrilla.avanzada';
let pasoActual = 1;
let avanzada = false;
try { avanzada = localStorage.getItem(CLAVE_AVANZADA) === 'si'; } catch (e) { /* sin guardado */ }

function mostrarSelector(visible) {
  selectorObjetivo.hidden = !visible;
  panelFormulario.hidden = panelResultados.hidden = barraInferior.hidden = visible;
}

function mostrarPaso() {
  const objetivo = OBJETIVOS[proyecto.objetivo];
  mostrarSelector(!objetivo);
  if (!objetivo) return;
  const pasos = objetivo.pasos;
  pasoActual = Math.min(pasoActual, pasos.length);
  contenedorPasos.innerHTML = pasos.map((id, i) =>
    `<button type="button" class="paso" data-paso="${i + 1}" aria-current="${i + 1 === pasoActual ? 'step' : 'false'}"><span>${i + 1}</span>${TITULOS_PASO[id]}</button>`).join('');
  grupos.forEach(g => g.hidden = !(pasos.includes(g.dataset.paso) && (avanzada || pasos[pasoActual - 1] === g.dataset.paso)));
  formulario.querySelectorAll('[data-objetivos]').forEach(e => e.hidden = !e.dataset.objetivos.split(' ').includes(proyecto.objetivo));
  botonAnterior.disabled = pasoActual === 1;
  botonSiguiente.disabled = pasoActual === pasos.length;
  contenedor.classList.toggle('avanzada', avanzada);
  botonAvanzada.setAttribute('aria-pressed', avanzada);
  botonAvanzada.textContent = avanzada ? '⚙ Volver a pasos' : '⚙ Configuración avanzada';
  barraInferior.hidden = avanzada;
  indicadorPaso.textContent = `Paso ${pasoActual} de ${pasos.length}`;
  document.getElementById('nombre-objetivo').textContent = objetivo.nombre;
}

function irAlPaso(numero) {
  pasoActual = Math.max(1, numero);
  mostrarPaso();
}

document.querySelectorAll('.tarjeta-objetivo').forEach(t => t.addEventListener('click', () => {
  proyecto.objetivo = t.dataset.objetivo;
  guardarProyecto(proyecto);
  pasoActual = 1;
  mostrarPaso();
  mostrarResultados();
}));
// "Elegir márgenes por mí": con el formato cargado, la app arma una grilla completa que cierra exacto
document.getElementById('boton-sugerir').addEventListener('click', () => {
  const s = sugerirProyecto(proyecto);
  if (!s.ok) { notaSugerencia.innerHTML = s.errores.map(t => mensaje('error', t)).join(''); return; }
  Object.assign(proyecto, s.campos);
  if (!['margenes', 'verificar'].includes(proyecto.objetivo)) proyecto.objetivo = 'margenes';   // para ver los cuatro márgenes
  guardarProyecto(proyecto);
  ponerEnFormulario();
  mostrarPaso();
  mostrarResultados();
  const r = s.resumen, u = r.unidadInterlineado;
  notaSugerencia.innerHTML = mensaje('ok', `Elegí por vos: interlineado de ${Grilla.redondear(r.interlineado)} ${u}, ` +
    `${r.filas} ${r.filas === 1 ? 'módulo' : 'módulos'} de ${r.lineasPorModulo} líneas, ${r.columnas} ${r.columnas === 1 ? 'columna' : 'columnas'} ` +
    `y márgenes de ${Grilla.redondear(r.margenEnPagina)} ${proyecto.unidad}. Todo cierra exacto.`);
});
document.getElementById('boton-restablecer').addEventListener('click', () => {
  proyecto = normalizarProyecto({ objetivo: proyecto.objetivo });     // vuelve a los valores iniciales, conserva el objetivo
  guardarProyecto(proyecto);
  ponerEnFormulario();
  mostrarResultados();
});
document.getElementById('boton-cambiar-objetivo').addEventListener('click', () => mostrarSelector(true));
contenedorPasos.addEventListener('click', e => { const b = e.target.closest('.paso'); if (b) irAlPaso(Number(b.dataset.paso)); });
botonAnterior.addEventListener('click', () => irAlPaso(pasoActual - 1));
botonSiguiente.addEventListener('click', () => irAlPaso(pasoActual + 1));
botonAvanzada.addEventListener('click', () => {
  avanzada = !avanzada;
  try { localStorage.setItem(CLAVE_AVANZADA, avanzada ? 'si' : 'no'); } catch (e) { /* sin guardado */ }
  mostrarPaso();
});
// Enter dentro de un campo avanza al paso siguiente en vez de enviar el formulario
formulario.addEventListener('submit', e => { e.preventDefault(); if (!avanzada) irAlPaso(pasoActual + 1); });

// --- MÓDULO 8: EVENTOS DEL FORMULARIO ---------------------------------------------------------------
formulario.addEventListener('input', e => {
  if (!e.target.name) return;
  notaSugerencia.innerHTML = '';
  leerCampo(e.target);
  guardarProyecto(proyecto);
  mostrarResultados();
});

// --- MÓDULO 9: INICIO --------------------------------------------------------------------------------
ponerEnFormulario();
mostrarPaso();
mostrarResultados();
