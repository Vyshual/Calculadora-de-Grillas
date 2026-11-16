/* =====================================================================================
   NÚCLEO DE CÁLCULO DE GRILLAS TIPOGRÁFICAS
   Sin interfaz: solo funciones puras. Unidad interna: PUNTOS (pt).
   ===================================================================================== */

// --- MÓDULO 1: CONSTANTES ------------------------------------------------------------
const TOLERANCIA = 1e-6;          // Margen de error aceptado al comparar decimales
const PUNTOS_POR_PULGADA = 72;
const MM_POR_PULGADA = 25.4;

// --- MÓDULO 2: CONVERSIÓN DE UNIDADES -------------------------------------------------
// Cuántos puntos vale 1 unidad. Los píxeles dependen de la resolución (ppp).
function puntosPorUnidad(unidad, ppp = 72) {
  switch (unidad) {
    case 'pt': return 1;
    case 'mm': return PUNTOS_POR_PULGADA / MM_POR_PULGADA;
    case 'cm': return (PUNTOS_POR_PULGADA / MM_POR_PULGADA) * 10;
    case 'in': return PUNTOS_POR_PULGADA;
    case 'px': return PUNTOS_POR_PULGADA / ppp;
    default: throw new Error(`Unidad desconocida: ${unidad}`);
  }
}

function aPuntos(valor, unidad, ppp) { return valor * puntosPorUnidad(unidad, ppp); }
function dePuntos(puntos, unidad, ppp) { return puntos / puntosPorUnidad(unidad, ppp); }

// --- MÓDULO 3: UTILIDADES NUMÉRICAS ----------------------------------------------------
function esEntero(x) { return Math.abs(x - Math.round(x)) < TOLERANCIA; }

// El redondeo se hace UNA sola vez, al final, nunca en pasos intermedios.
function redondear(valor, decimales = 2) {
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
}

// --- MÓDULO 4: CÁLCULO VERTICAL (grilla base / renglones) -------------------------------
/* Entrada (todo en puntos):
   alto, interlineado, filas, lineasPorModulo, lineasMedianil,
   modoMargenes: 'clasico' (múltiplos del interlineado, predeterminado) | 'libre'
   margenSuperior, margenInferior (solo en modo libre) */
function calcularVertical(datos) {
  const { alto, interlineado, filas = 1, lineasPorModulo, lineasMedianil = 0,
          modoMargenes = 'clasico', margenSuperior = 0, margenInferior = 0 } = datos;
  const errores = [], avisos = [];

  if (!(alto > 0) || !(interlineado > 0)) {
    return { ok: false, errores: ['El alto y el interlineado deben ser mayores que 0.'], avisos };
  }

  // Líneas que ocupa la caja de texto: módulos + líneas de separación entre ellos
  const lineasCaja = filas * lineasPorModulo + (filas - 1) * lineasMedianil;
  const alturaCaja = lineasCaja * interlineado;

  if (modoMargenes === 'clasico') {
    const lineasPagina = alto / interlineado;
    if (!esEntero(lineasPagina)) {
      // El alto no es múltiplo del interlineado: se centra la caja y se reparte lo que sobra en los márgenes
      const margen = (alto - alturaCaja) / 2;
      if (margen < -TOLERANCIA) errores.push('La caja de texto es más alta que la página.');
      else {
        avisos.push('El alto de la página no es múltiplo exacto del interlineado: los márgenes salen aproximados (no múltiplos de línea).');
        return { ok: true, errores, avisos, resultado: {
          lineasPagina, lineasCaja, alturaCaja, margenSuperior: margen, margenInferior: margen,
          lineasMargenSuperior: margen / interlineado, lineasMargenInferior: margen / interlineado,
          sobrante: 0, aproximado: true } };
      }
    } else {
      const lineasMargen = Math.round(lineasPagina) - lineasCaja;
      if (lineasMargen < 0) errores.push('La caja de texto es más alta que la página.');
      else {
        const lineasSup = Math.floor(lineasMargen / 2);
        const lineasInf = lineasMargen - lineasSup;
        if (lineasSup !== lineasInf) avisos.push('Los márgenes no pueden ser simétricos: el inferior tiene una línea más.');
        return { ok: true, errores, avisos, resultado: {
          lineasPagina: Math.round(lineasPagina), lineasCaja, alturaCaja,
          margenSuperior: lineasSup * interlineado, margenInferior: lineasInf * interlineado,
          lineasMargenSuperior: lineasSup, lineasMargenInferior: lineasInf, sobrante: 0 } };
      }
    }
    return { ok: false, errores, avisos };
  }

  // Modo libre: la grilla base flota dentro de la caja disponible
  const cajaDisponible = alto - margenSuperior - margenInferior;
  if (cajaDisponible <= 0) return { ok: false, errores: ['Los márgenes ocupan toda la página.'], avisos };
  const lineasQueCaben = Math.floor(cajaDisponible / interlineado + TOLERANCIA);
  const sobrante = cajaDisponible - lineasQueCaben * interlineado;
  if (lineasCaja > lineasQueCaben) errores.push(`Solo caben ${lineasQueCaben} líneas y pedís ${lineasCaja}.`);
  if (sobrante > TOLERANCIA) avisos.push('La grilla base no cierra exacta: sobra espacio al final de la caja.');
  return { ok: errores.length === 0, errores, avisos, resultado: {
    lineasPagina: alto / interlineado, lineasCaja, alturaCaja, margenSuperior, margenInferior,
    lineasQueCaben, sobrante } };
}

// --- MÓDULO 5: CÁLCULO HORIZONTAL (columnas) --------------------------------------------
// Entrada (en puntos): ancho, margenIzquierdo, margenDerecho, columnas, medianil.
// En páginas enfrentadas, "izquierdo" = interior y "derecho" = exterior (o al revés según la página).
function calcularHorizontal({ ancho, margenIzquierdo, margenDerecho, columnas = 1, medianil = 0 }) {
  const errores = [];
  if (!(ancho > 0)) errores.push('El ancho debe ser mayor que 0.');
  if (!Number.isInteger(columnas) || columnas < 1) errores.push('Las columnas deben ser un entero ≥ 1.');
  if (errores.length) return { ok: false, errores, avisos: [] };

  const anchoUtil = ancho - margenIzquierdo - margenDerecho;
  const anchoColumna = (anchoUtil - (columnas - 1) * medianil) / columnas;
  if (anchoColumna <= 0) return { ok: false, errores: ['Las columnas y medianiles no caben en el ancho útil.'], avisos: [] };
  return { ok: true, errores: [], avisos: [], resultado: { anchoUtil, anchoColumna } };
}

// --- MÓDULO 5B: MÁRGENES HORIZONTALES (a partir del ancho de columna deseado) ---------------
// Entrada (en puntos): ancho, columnas, medianil, anchoColumna. Devuelve márgenes simétricos.
function calcularMargenesHorizontales({ ancho, columnas = 1, medianil = 0, anchoColumna }) {
  if (!(ancho > 0) || !(anchoColumna > 0) || !Number.isInteger(columnas) || columnas < 1) {
    return { ok: false, errores: ['Revisá el ancho, el ancho de columna y la cantidad de columnas.'], avisos: [] };
  }
  const sobrante = ancho - columnas * anchoColumna - (columnas - 1) * medianil;
  if (sobrante < -TOLERANCIA) return { ok: false, errores: ['Las columnas con ese ancho no caben en la página.'], avisos: [] };
  const margen = Math.max(0, sobrante) / 2;
  return { ok: true, errores: [], avisos: [], resultado: { margen, anchoUtil: ancho - 2 * margen } };
}

// --- MÓDULO 5C: MARGEN RÁPIDO (por cantidad de módulos, medianil de una línea) --------------------
/* Entrada (en puntos): alto, interlineado, modulos, margenAproximado (opcional).
   El espacio entre módulos es UNA línea (igual al interlineado).
   Como las líneas por módulo no se conocen, devuelve todas las opciones que cierran exacto. */
function calcularMargenRapido({ alto, interlineado, modulos, margenAproximado = 0 }) {
  if (!(Number.isFinite(alto) && alto > 0) || !(Number.isFinite(interlineado) && interlineado > 0) || !Number.isInteger(modulos) || modulos < 1) {
    return { ok: false, errores: ['Revisá el alto, el interlineado y la cantidad de módulos.'], opciones: [] };
  }
  const lineasPagina = alto / interlineado;
  const exacto = esEntero(lineasPagina);            // ¿el alto es múltiplo exacto del interlineado?
  const lineasEntreModulos = modulos - 1;
  const opciones = [];
  for (let k = 1; k <= 100000; k++) {          // tope de seguridad
    const lineasCaja = modulos * k + lineasEntreModulos;
    const sobra = alto - lineasCaja * interlineado;                  // espacio que queda para los dos márgenes
    if (sobra < 2 * interlineado - TOLERANCIA) break;                // mínimo una línea de margen por lado
    if (exacto) {
      const resto = Math.round(lineasPagina) - lineasCaja;
      const sup = Math.floor(resto / 2), inf = resto - sup;
      opciones.push({ lineasPorModulo: k, lineasCaja, lineasMargenSuperior: sup, lineasMargenInferior: inf,
        margenSuperior: sup * interlineado, margenInferior: inf * interlineado, simetrico: sup === inf });
    } else {                                                          // aproximado: caja centrada
      opciones.push({ lineasPorModulo: k, lineasCaja, margenSuperior: sobra / 2, margenInferior: sobra / 2, simetrico: true });
    }
  }
  // Simétricas primero; después, por cercanía al margen aproximado (o de menor a mayor si no se indicó)
  const distancia = o => margenAproximado > 0 ? Math.abs(o.margenSuperior - margenAproximado) : o.margenSuperior;
  opciones.sort((x, y) => (y.simetrico - x.simetrico) || (distancia(x) - distancia(y)));
  // Si no es exacto: qué interlineado haría que todo cierre
  const lineasCercanas = Math.round(lineasPagina);
  const sugerencia = !exacto && lineasCercanas >= 1 ? { interlineado: alto / lineasCercanas, lineasPagina: lineasCercanas } : null;
  return { ok: true, errores: [], opciones, exacto, sugerencia };
}

// --- MÓDULO 5D: SUGERENCIA AUTOMÁTICA ("elegir por mí") ---------------------------------------
/* Entrada: ancho y alto en UNA misma unidad. Devuelve interlineado, módulos, columnas y márgenes
   (en esa misma unidad) que cierran exacto:
   - interlineado = alto / N líneas, así la página siempre se divide justo; se prefiere un valor redondo
   - margen ≈ 9 % del lado menor, siempre múltiplo del interlineado (estilo clásico)
   - módulos: se busca una cantidad que reparta bien las líneas, con una línea entre módulos */
function sugerirGrilla({ ancho, alto, lineasObjetivo = 48 }) {
  if (!(Number.isFinite(ancho) && ancho > 0) || !(Number.isFinite(alto) && alto > 0)) {
    return { ok: false, errores: ['Cargá primero el ancho y el alto de la página.'] };
  }
  let mejor = null;
  for (let lineas = Math.max(12, lineasObjetivo - 12); lineas <= lineasObjetivo + 12; lineas++) {
    const interlineado = alto / lineas;
    const puntaje = Math.abs(interlineado - Math.round(interlineado * 2) / 2) + 0.002 * Math.abs(lineas - lineasObjetivo);
    if (!mejor || puntaje < mejor.puntaje) mejor = { lineas, interlineado, puntaje };
  }
  const { lineas, interlineado } = mejor;
  const lineasMargenBase = Math.max(2, Math.round(0.09 * Math.min(ancho, alto) / interlineado));

  const armar = (lineasMargen, filas, lineasPorModulo) => {
    const margen = lineasMargen * interlineado;
    const columnas = ancho > alto * 1.2 ? 2 : 1;                    // apaisado: dos columnas
    const medianil = columnas > 1 ? interlineado : 0;
    const anchoColumna = (ancho - 2 * margen - (columnas - 1) * medianil) / columnas;
    if (!(anchoColumna > 0)) return { ok: false, errores: ['La página es demasiado chica para sugerir una grilla.'] };
    return { ok: true, errores: [], resultado: { interlineado, lineasPagina: lineas, lineasMargen, filas, lineasPorModulo,
      lineasEntreModulos: 1, margen, columnas, medianil, anchoColumna } };
  };

  for (const delta of [0, 1, -1, 2, -2]) {                          // se mueve el margen una o dos líneas si hace falta
    const lineasMargen = lineasMargenBase + delta;
    if (lineasMargen < 1) continue;
    const disponibles = lineas - 2 * lineasMargen;
    for (const filas of [3, 4, 5, 2, 6, 7, 8]) {
      const lineasPorModulo = (disponibles - (filas - 1)) / filas;
      if (Number.isInteger(lineasPorModulo) && lineasPorModulo >= 2) return armar(lineasMargen, filas, lineasPorModulo);
    }
  }
  const unica = lineas - 2 * lineasMargenBase;                       // respaldo: un solo módulo
  return unica >= 1 ? armar(lineasMargenBase, 1, unica)
                    : { ok: false, errores: ['La página es demasiado chica para sugerir una grilla.'] };
}

// --- MÓDULO 6: BÚSQUEDA INVERSA ----------------------------------------------------------
/* Dado alto y margen deseado (en la misma unidad), lista interlineados enteros. Los que cierran exacto van
   primero; los demás dan un margen aproximado. */
function buscarGrillas({ alto, margenDeseado, interlineadoMin = 8, interlineadoMax = 60 }) {
  const resultados = [];
  for (let interlineado = interlineadoMin; interlineado <= interlineadoMax; interlineado++) {
    const lineasMargen = Math.max(1, Math.round(margenDeseado / interlineado));
    const lineasCaja = Math.floor((alto - 2 * lineasMargen * interlineado) / interlineado + TOLERANCIA);
    if (lineasCaja < 1) continue;
    const margenReal = (alto - lineasCaja * interlineado) / 2;      // si no cierra exacto, el sobrante va a los márgenes
    resultados.push({ interlineado, lineasPagina: alto / interlineado, lineasMargen, lineasCaja, margenReal,
      exacta: esEntero(alto / interlineado), diferencia: Math.abs(margenReal - margenDeseado) });
  }
  return resultados.sort((x, y) => (y.exacta - x.exacta) || (x.diferencia - y.diferencia));
}

// --- MÓDULO 7: EXPORTACIÓN ---------------------------------------------------------------
const Grilla = { aPuntos, dePuntos, redondear, calcularVertical, calcularHorizontal, calcularMargenesHorizontales, calcularMargenRapido, sugerirGrilla, buscarGrillas };
if (typeof module !== 'undefined') module.exports = Grilla;   // Node (pruebas)
else window.Grilla = Grilla;                                   // Navegador
