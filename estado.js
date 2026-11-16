/* =====================================================================================
   ESTADO COMPARTIDO ENTRE PANTALLAS
   Guarda los datos del proyecto y los resuelve usando el núcleo (nucleo.js).
   ===================================================================================== */

// --- MÓDULO 1: DATOS PREDETERMINADOS -------------------------------------------------
const PROYECTO_INICIAL = {
  objetivo: '',                       // '' = todavía no eligió qué quiere obtener
  unidad: 'px', ppp: 72, ancho: 1080, alto: 1080,
  unidadInterlineado: 'px', interlineado: 24,
  modoMargenes: 'clasico', margenSuperior: 72, margenInferior: 72,
  margenIzquierdo: 72, margenDerecho: 72,
  columnas: 1, medianil: 0, anchoColumna: 0,
  filas: 1, lineasPorModulo: 39, lineasMedianil: 0,
  margenDeseado: 72, margenAproximado: 0,
  subdivision: 2                      // grilla pequeña: 2 = mitad del interlineado, 3 = tercio, 4 = cuarto, 1 = sin grilla pequeña
};

// --- MÓDULO 2: GUARDAR Y CARGAR --------------------------------------------------------
const CLAVE_GUARDADO = 'estudioGrilla.proyecto';

// Los campos numéricos se convierten a número siempre (un "6" guardado como texto rompía los cálculos)
function normalizarProyecto(datos) {
  const proyecto = { ...PROYECTO_INICIAL, ...datos };
  for (const clave of Object.keys(PROYECTO_INICIAL)) {
    if (typeof PROYECTO_INICIAL[clave] !== 'number') continue;
    const numero = Number(proyecto[clave]);
    proyecto[clave] = Number.isFinite(numero) ? numero : PROYECTO_INICIAL[clave];
  }
  if (!(proyecto.ppp > 0)) proyecto.ppp = PROYECTO_INICIAL.ppp;
  return proyecto;
}

function cargarProyecto() {
  try { return normalizarProyecto(JSON.parse(localStorage.getItem(CLAVE_GUARDADO))); }
  catch (e) { return normalizarProyecto({}); }
}

function guardarProyecto(proyecto) {
  try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(proyecto)); } catch (e) { /* sin guardado */ }
}

// --- MÓDULO 3: RESOLUCIÓN (convierte a puntos, calcula y devuelve todo) -------------------
// Objetivo "margenes": los márgenes se CALCULAN (simétricos). Objetivo "verificar": se ingresan.
const RESOLUCION_INVALIDA = 'La resolución (ppp) tiene que ser mayor que 0.';

function resolverProyecto(p) {
  if (!(p.ppp > 0)) {
    return { vertical: { ok: false, errores: [RESOLUCION_INVALIDA], avisos: [] }, horizontal: { ok: false, errores: [], avisos: [] },
             medidas: { ancho: 0, alto: 0, interlineado: 0, medianil: 0, margenIzquierdo: 0, margenDerecho: 0 } };
  }
  const pt = (valor, unidad = p.unidad) => Grilla.aPuntos(valor, unidad, p.ppp);
  const interlineado = pt(p.interlineado, p.unidadInterlineado);
  const alto = pt(p.alto), ancho = pt(p.ancho), medianil = pt(p.medianil);
  let margenSuperior = pt(p.margenSuperior), margenInferior = pt(p.margenInferior);
  let margenIzquierdo = pt(p.margenIzquierdo), margenDerecho = pt(p.margenDerecho);
  const calculaMargenes = p.objetivo === 'margenes';

  // Vertical libre + calculado: la caja queda centrada
  if (calculaMargenes && p.modoMargenes === 'libre') {
    const lineasCaja = p.filas * p.lineasPorModulo + (p.filas - 1) * p.lineasMedianil;
    margenSuperior = margenInferior = Math.max(0, (alto - lineasCaja * interlineado) / 2);
  }

  const vertical = Grilla.calcularVertical({
    alto, interlineado, filas: p.filas, lineasPorModulo: p.lineasPorModulo,
    lineasMedianil: p.lineasMedianil, modoMargenes: p.modoMargenes, margenSuperior, margenInferior
  });
  // Horizontal: el margen sale del ancho de columna deseado; si es 0, los laterales igualan a los verticales
  let paso = null;
  if (calculaMargenes && p.anchoColumna > 0) {
    paso = Grilla.calcularMargenesHorizontales({ ancho, columnas: p.columnas, medianil, anchoColumna: pt(p.anchoColumna) });
    if (paso.ok) margenIzquierdo = margenDerecho = paso.resultado.margen;
  } else if (calculaMargenes && vertical.ok) {
    margenIzquierdo = margenDerecho = vertical.resultado.margenSuperior;
  }
  const horizontal = paso && !paso.ok ? paso :
    Grilla.calcularHorizontal({ ancho, margenIzquierdo, margenDerecho, columnas: p.columnas, medianil });
  return { vertical, horizontal, medidas: { ancho, alto, interlineado, medianil, margenIzquierdo, margenDerecho } };
}

// --- MÓDULO 4: BÚSQUEDA DE INTERLINEADOS (objetivo "interlineado") ---------------------------
// Trabaja en la unidad del interlineado, porque busca interlineados enteros.
function resolverBusqueda(p) {
  if (!(p.ppp > 0)) return [];
  const aUnidad = v => Grilla.dePuntos(Grilla.aPuntos(v, p.unidad, p.ppp), p.unidadInterlineado, p.ppp);
  return Grilla.buscarGrillas({ alto: aUnidad(p.alto), margenDeseado: aUnidad(p.margenDeseado) }).slice(0, 8);
}

// --- MÓDULO 5: MARGEN RÁPIDO (objetivo "rapido") ------------------------------------------------
// Dice exactamente qué dato está mal y qué valor leyó, en vez de un mensaje genérico
function resolverRapido(p) {
  const problemas = [];
  if (!(Number(p.ppp) > 0)) problemas.push(`la resolución (ppp) tiene que ser mayor que 0 (hoy dice ${p.ppp})`);
  if (!(Number(p.alto) > 0)) problemas.push(`el alto tiene que ser mayor que 0 (hoy dice ${p.alto})`);
  if (!(Number(p.interlineado) > 0)) problemas.push(`el interlineado tiene que ser mayor que 0 (hoy dice ${p.interlineado})`);
  if (!Number.isInteger(Number(p.filas)) || Number(p.filas) < 1) problemas.push(`la cantidad de módulos tiene que ser un entero desde 1 (hoy dice ${p.filas})`);
  if (problemas.length) return { ok: false, errores: problemas.map(t => `Revisá: ${t}.`), opciones: [] };
  return Grilla.calcularMargenRapido({
    alto: Grilla.aPuntos(p.alto, p.unidad, p.ppp),
    interlineado: Grilla.aPuntos(p.interlineado, p.unidadInterlineado, p.ppp),
    modulos: Number(p.filas),
    margenAproximado: Grilla.aPuntos(p.margenAproximado, p.unidad, p.ppp)
  });
}

// --- MÓDULO 6: SUGERENCIA AUTOMÁTICA PARA EL FORMATO ACTUAL ------------------------------------
// Devuelve los campos del proyecto ya listos para cargar. El interlineado va en px o pt (mm/cm/in pasan a pt).
function sugerirProyecto(p) {
  if (!(p.ppp > 0)) return { ok: false, errores: [RESOLUCION_INVALIDA] };
  const unidadI = (p.unidad === 'px' || p.unidad === 'pt') ? p.unidad : 'pt';
  const aUnidadI = v => Grilla.dePuntos(Grilla.aPuntos(v, p.unidad, p.ppp), unidadI, p.ppp);
  const aPagina = v => Grilla.redondear(Grilla.dePuntos(Grilla.aPuntos(v, unidadI, p.ppp), p.unidad, p.ppp), 6);
  const s = Grilla.sugerirGrilla({ ancho: aUnidadI(p.ancho), alto: aUnidadI(p.alto) });
  if (!s.ok) return s;
  const r = s.resultado, margen = aPagina(r.margen);
  return { ok: true, errores: [], resumen: { ...r, unidadInterlineado: unidadI, margenEnPagina: margen }, campos: {
    unidadInterlineado: unidadI, interlineado: Grilla.redondear(r.interlineado, 8), modoMargenes: 'clasico',
    filas: r.filas, lineasPorModulo: r.lineasPorModulo, lineasMedianil: r.lineasEntreModulos,
    columnas: r.columnas, medianil: aPagina(r.medianil), anchoColumna: 0,
    margenSuperior: margen, margenInferior: margen, margenIzquierdo: margen, margenDerecho: margen, margenDeseado: margen } };
}

if (typeof module !== 'undefined') module.exports = { PROYECTO_INICIAL, normalizarProyecto, resolverProyecto, resolverBusqueda, resolverRapido, sugerirProyecto };
