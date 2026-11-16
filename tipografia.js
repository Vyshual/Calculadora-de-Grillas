/* =====================================================================================
   SECCIÓN TIPOGRAFÍA: jerarquías de texto probadas sobre la grilla base
   Cada nivel: nombre, tipografía, peso, tamaño (pt) e interlineado (pt).
   La hoja es un SVG (texto real): sirve de vista previa, de PNG y de PDF (vía imprimir).
   ===================================================================================== */

// --- MÓDULO 1: DATOS Y GUARDADO ---------------------------------------------------------------
const CLAVE_TIPO = 'estudioGrilla.tipografia';
const PESOS = { 300: 'Light', 400: '', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold' };
const MUESTRA_CORTA = 'Hamburguesa tipográfica 0123';
const MUESTRA_LARGA = 'La grilla base ordena el ritmo vertical del texto: cada renglón se apoya en una línea y las jerarquías respiran en múltiplos del mismo interlineado.';
const entero = v => String(Math.round(v * 100) / 100);
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const lienzoMedida = document.createElement('canvas').getContext('2d');
const subdivision = () => Math.max(1, Math.round(Number(proyecto.subdivision) || 1));
// Interlineado de la grilla base, en puntos
const interlineadoBase = () => Grilla.aPuntos(proyecto.interlineado, proyecto.unidadInterlineado, proyecto.ppp);

// Genera los niveles desde el cuerpo y una razón. El interlineado es múltiplo de la grilla principal;
// la nota (más chica que el cuerpo) se apoya en la grilla pequeña si existe.
function generarEscala(fuente, cuerpo, razon, base, sub = 1) {
  const niveles = [['Título', 4, 700], ['Título 2', 3, 700], ['Subtítulo', 2, 600], ['Párrafo', 0, 400], ['Nota', -1, 400]];
  return niveles.map(([nombre, paso, peso]) => {
    const tamano = Math.round(cuerpo * Math.pow(razon, paso) * 2) / 2;
    const chica = paso < 0 && sub > 1 && base > 0, unidad = chica ? base / sub : base;
    let interlineado = base;
    if (paso > 0) interlineado = Math.max(base, Math.ceil(tamano * 1.15 / base - 1e-6) * base);
    if (chica) interlineado = Math.ceil(tamano * 1.15 / unidad - 1e-6) * unidad;
    if (!(base > 0)) interlineado = tamano * 1.2;
    return { nombre, fuente, peso, tamano, interlineado: Math.round(interlineado * 100) / 100, grilla: chica ? 'pequena' : 'base' };
  });
}

function cargarTipo() {
  try { const g = JSON.parse(localStorage.getItem(CLAVE_TIPO)); if (g && Array.isArray(g.niveles)) return g; } catch (e) { /* sin guardado */ }
  return { base: 'Georgia', cuerpo: 11, razon: 1.25, niveles: generarEscala('Georgia', 11, 1.25, interlineadoBase(), subdivision()) };
}
let tipo = cargarTipo();
const guardarTipo = () => { try { localStorage.setItem(CLAVE_TIPO, JSON.stringify(tipo)); } catch (e) { /* sin guardado */ } };

// --- MÓDULO 2: ESPECIFICACIÓN Y CONTROL DE GRILLA ------------------------------------------------
const especificacion = n => `${n.nombre} ${n.fuente}${PESOS[n.peso] ? ' ' + PESOS[n.peso] : ''} ${entero(n.tamano)}pt / ${entero(n.interlineado)}pt`;

// ¿La fuente está instalada? Se compara el ancho del texto con el de una tipografía genérica
function fuenteInstalada(nombre) {
  const limpio = String(nombre || '').replace(/["\\]/g, '').trim();
  if (!limpio) return false;
  if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(limpio)) return true;
  const ctx = lienzoMedida, muestra = 'mmmmmmmmmmlliWwq0123456789';
  const ancho = familia => { ctx.font = `72px ${familia}`; return ctx.measureText(muestra).width; };
  return ['monospace', 'serif', 'sans-serif'].some(g => ancho(`"${limpio}", ${g}`) !== ancho(g));
}

// Paso de la grilla en la que se apoya el nivel (principal o pequeña)
const pasoDe = n => n.grilla === 'pequena' ? interlineadoBase() / subdivision() : interlineadoBase();

function estadoNivel(n) {
  const base = interlineadoBase(), paso = pasoDe(n), k = n.interlineado / paso;
  const grilla = n.grilla === 'pequena' && subdivision() > 1 ? 'grilla pequeña' : 'grilla';
  if (!(base > 0)) return { ok: false, texto: 'Cargá primero el interlineado en la sección Grilla.' };
  if (n.interlineado < n.tamano) return { ok: false, texto: 'El interlineado es menor que el tamaño de la letra.' };
  if (Math.abs(n.interlineado - Math.round(k) * paso) > 0.01 || Math.round(k) < 1) return { ok: false, texto: `No es múltiplo de la ${grilla} (${entero(paso)} pt).` };
  return { ok: true, texto: `Ocupa ${Math.round(k)} ${Math.round(k) === 1 ? 'línea' : 'líneas'} de ${grilla} por renglón.` };
}

// --- MÓDULO 3: ARMAR LA HOJA (SVG en puntos) ----------------------------------------------------------
const medir = (texto, n) => { lienzoMedida.font = `${n.peso} ${n.tamano}px "${n.fuente}"`; return lienzoMedida.measureText(texto).width; };

function envolver(texto, n, ancho) {
  const lineas = []; let actual = '';
  for (const palabra of texto.split(' ')) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (!actual || medir(prueba, n) <= ancho) actual = prueba; else { lineas.push(actual); actual = palabra; }
  }
  return actual ? [...lineas, actual] : lineas;
}

function armarHoja() {
  const base = interlineadoBase(), pt = v => Grilla.aPuntos(v, proyecto.unidad, proyecto.ppp);
  const W = pt(proyecto.ancho), H = pt(proyecto.alto);
  if (!(W > 0 && H > 0 && base > 0 && Number.isFinite(W + H + base))) return null;
  const res = resolverProyecto(proyecto), buena = res.vertical.ok && res.horizontal.ok;
  const x0 = buena ? res.medidas.margenIzquierdo : base * 2, y0 = buena ? res.vertical.resultado.margenSuperior : base * 2;
  const ancho = buena ? res.horizontal.resultado.anchoColumna : W - 2 * x0, alto = buena ? res.vertical.resultado.alturaCaja : H - 2 * y0;
  const anchoCaja = buena ? res.horizontal.resultado.anchoUtil : ancho;
  const trazo = (color, grosor, opacidad = 1) => `fill="none" stroke="${color}" stroke-width="${grosor}" stroke-opacity="${opacidad}"`;

  let svg = `<rect width="${W}" height="${H}" fill="#fff"/>`;
  const sub = subdivision();
  if (sub > 1) for (let j = 0; j * base / sub <= alto + 1e-6; j++) if (j % sub) svg += `<line x1="${x0}" x2="${x0 + anchoCaja}" y1="${y0 + j * base / sub}" y2="${y0 + j * base / sub}" stroke="#00a3c4" stroke-width="0.3" stroke-opacity="0.45" stroke-dasharray="1.5 1.5"/>`;
  for (let i = 0; i * base <= alto + 1e-6; i++) svg += `<line x1="${x0}" x2="${x0 + anchoCaja}" y1="${y0 + i * base}" y2="${y0 + i * base}" stroke="#00a3c4" stroke-width="0.4" stroke-opacity="0.55"/>`;
  svg += `<rect x="${x0}" y="${y0}" width="${anchoCaja}" height="${alto}" ${trazo('#d02a6b', 0.8)}/>`;

  const noEntran = []; let cursor = 0;                      // cursor = altura (pt) ya ocupada, desde el margen superior
  const sube = (v, paso) => Math.ceil(v / paso - 1e-6) * paso;
  for (const n of tipo.niveles) {
    const paso = pasoDe(n), k = n.interlineado / paso, largo = n.tamano <= 14;   // el interlineado casi múltiplo se ajusta exacto
    const L = n.interlineado > 0 ? (Math.round(k) >= 1 && Math.abs(n.interlineado - Math.round(k) * paso) < 0.01 ? Math.round(k) * paso : n.interlineado) : base;
    const textos = [...envolver(especificacion(n), n, ancho), ...envolver(largo ? MUESTRA_LARGA : MUESTRA_CORTA, n, ancho).slice(0, largo ? 3 : 1)];
    const primera = sube(cursor + L, paso), ultima = primera + (textos.length - 1) * L;   // cada renglón cae sobre una línea de su grilla
    if (ultima > alto + 1e-6) { noEntran.push(n.nombre); continue; }
    textos.forEach((tx, i) => { svg += `<text x="${x0}" y="${y0 + primera + i * L}" style="font-family:'${esc(n.fuente)}',serif;font-weight:${n.peso};font-size:${n.tamano}px" fill="#111">${esc(tx)}</text>`; });
    cursor = sube(ultima, base) + base;                      // una línea de la grilla principal de aire entre niveles
  }
  return { W, H, noEntran, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}pt" height="${H}pt">${svg}</svg>` };
}

// --- MÓDULO 4: PANTALLA (niveles, hoja y paleta) ---------------------------------------------------------
const $t = id => document.getElementById(id);
const opcionesPeso = actual => Object.entries(PESOS).map(([v, nombre]) => `<option value="${v}"${Number(v) === actual ? ' selected' : ''}>${nombre || 'Regular'}</option>`).join('');

function pintarNiveles() {
  $t('niveles').innerHTML = tipo.niveles.map((n, i) => `<div class="nivel" data-i="${i}">
    <div class="fila"><label>Nombre<input data-c="nombre" value="${esc(n.nombre)}"></label><label>Tipografía<input data-c="fuente" list="lista-fuentes" value="${esc(n.fuente)}"></label></div>
    <div class="fila tres"><label>Peso<select data-c="peso">${opcionesPeso(n.peso)}</select></label>
      <label>Tamaño (pt)<input type="number" data-c="tamano" min="1" step="0.5" inputmode="decimal" value="${n.tamano}"></label>
      <label>Interlineado (pt)<input type="number" data-c="interlineado" min="1" step="0.5" inputmode="decimal" value="${n.interlineado}"></label></div>
    <div class="fila"><label>Se apoya en<select data-c="grilla"><option value="base"${n.grilla === 'pequena' ? '' : ' selected'}>Grilla principal</option><option value="pequena"${n.grilla === 'pequena' ? ' selected' : ''}>Grilla pequeña</option></select></label></div>
    <p class="estado-nivel"></p>
    <div class="acciones"><button type="button" class="chip" data-accion="ajustar">Ajustar a la grilla</button><button type="button" class="chip" data-accion="subir" aria-label="Subir">↑</button><button type="button" class="chip" data-accion="bajar" aria-label="Bajar">↓</button><button type="button" class="chip" data-accion="quitar">Quitar</button></div></div>`).join('');
  actualizarTipografia();
}

function actualizarTipografia() {
  $t('tipo-interlineado-base').value = interlineadoBase() > 0 ? `${entero(interlineadoBase())} pt` : '—';
  document.querySelectorAll('.nivel').forEach((caja, i) => {
    const e = estadoNivel(tipo.niveles[i]), p = caja.querySelector('.estado-nivel');
    p.className = `estado-nivel ${e.ok ? 'ok' : 'aviso'}`; p.textContent = (e.ok ? '✓ ' : '! ') + e.texto + (fuenteInstalada(tipo.niveles[i].fuente) ? '' : ' · Fuente no encontrada: se muestra otra.');
  });
  const hoja = armarHoja();
  $t('hoja').innerHTML = hoja ? hoja.svg : '<p class="vacio">Cargá el formato y el interlineado en la sección Grilla para ver la hoja.</p>';
  const aviso = hoja && hoja.noEntran.length ? `<p class="mensaje aviso"><span>No entran en la hoja: ${esc(hoja.noEntran.join(', '))}. Probá con tamaños menores.</span></p>` : '';
  $t('paleta').innerHTML = aviso + (tipo.niveles.map(n => { const e = estadoNivel(n); return `<div class="linea-paleta"><span>${esc(especificacion(n))}</span><small class="${e.ok ? 'ok' : 'aviso'}">${e.ok ? '✓ en grilla' : '! fuera de grilla'}</small></div>`; }).join('') || '<p class="vacio">Agregá un nivel para empezar.</p>');
}

$t('niveles').addEventListener('input', e => {
  const c = e.target.dataset.c; if (!c) return;
  const n = tipo.niveles[Number(e.target.closest('.nivel').dataset.i)];
  n[c] = (c === 'nombre' || c === 'fuente' || c === 'grilla') ? e.target.value : Number(e.target.value) || 0;
  guardarTipo(); actualizarTipografia();
});
$t('niveles').addEventListener('click', e => {
  const accion = e.target.dataset.accion; if (!accion) return;
  const i = Number(e.target.closest('.nivel').dataset.i), lista = tipo.niveles, base = interlineadoBase();
  if (accion === 'quitar') lista.splice(i, 1);
  if (accion === 'subir' && i > 0) [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]];
  if (accion === 'bajar' && i < lista.length - 1) [lista[i + 1], lista[i]] = [lista[i], lista[i + 1]];
  if (accion === 'ajustar' && base > 0) { const n = lista[i], paso = pasoDe(n); n.interlineado = Math.round(Math.max(paso, Math.round(n.interlineado / paso) * paso, Math.ceil(n.tamano / paso - 1e-6) * paso) * 100) / 100; }
  guardarTipo(); pintarNiveles();
});
$t('tipo-agregar').addEventListener('click', () => {
  const modelo = tipo.niveles.find(n => n.nombre === 'Párrafo') || { fuente: tipo.base, peso: 400, tamano: tipo.cuerpo, interlineado: interlineadoBase() };
  tipo.niveles.push({ ...modelo, nombre: 'Nuevo nivel' }); guardarTipo(); pintarNiveles();
});
$t('tipo-generar').addEventListener('click', () => {
  tipo.base = $t('tipo-base').value.trim() || tipo.base; tipo.cuerpo = Number($t('tipo-cuerpo').value) || tipo.cuerpo; tipo.razon = Number($t('tipo-razon').value);
  tipo.niveles = generarEscala(tipo.base, tipo.cuerpo, tipo.razon, interlineadoBase(), subdivision()); guardarTipo(); pintarNiveles();
});
$t('tipo-fuentes').addEventListener('click', async () => {
  const estado = $t('tipo-fuentes-estado');
  if (!window.queryLocalFonts) { estado.textContent = 'Este navegador no puede listar las fuentes (solo Chrome y Edge). Escribí el nombre igual: la app avisa si la tipografía está instalada.'; return; }
  if (!window.isSecureContext) { estado.textContent = 'El navegador solo permite listar las fuentes desde una página segura (https o localhost), no desde un archivo local. Subila a GitHub Pages o escribí el nombre a mano.'; return; }
  try {
    const familias = [...new Set((await window.queryLocalFonts()).map(f => f.family))].sort((a, b) => a.localeCompare(b));
    $t('lista-fuentes').innerHTML = familias.map(f => `<option value="${esc(f)}">`).join('');
    estado.textContent = `${familias.length} familias cargadas. Elegilas en los campos "Tipografía".`;
  } catch (err) { estado.textContent = `El navegador no dio acceso a las fuentes (${err.name}: ${err.message}). Revisá el permiso del sitio o escribí el nombre a mano.`; }
});
$t('tipo-ampliar').addEventListener('click', () => { const hoja = armarHoja(); if (hoja) abrirVisor('Hoja de prueba', hoja.svg); });

// --- MÓDULO 5: EXPORTAR (copiar, PNG, PDF) -------------------------------------------------------------------
$t('tipo-copiar').addEventListener('click', async e => {
  try { await navigator.clipboard.writeText(tipo.niveles.map(especificacion).join('\n')); e.target.textContent = 'Copiada ✓'; } catch (err) { e.target.textContent = 'No se pudo copiar'; }
  setTimeout(() => e.target.textContent = 'Copiar paleta', 1800);
});
$t('tipo-png').addEventListener('click', () => {
  const hoja = armarHoja(); if (!hoja) return;
  const escala = Math.min(3, 4096 / Math.max(hoja.W, hoja.H)), imagen = new Image();
  imagen.onload = () => {
    const lienzo = document.createElement('canvas'); lienzo.width = Math.round(hoja.W * escala); lienzo.height = Math.round(hoja.H * escala);
    const ctx = lienzo.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, lienzo.width, lienzo.height); ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    lienzo.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'paleta-tipografica.png'; a.click(); URL.revokeObjectURL(a.href); });
  };
  imagen.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(hoja.svg);
});
$t('tipo-pdf').addEventListener('click', () => {      // PDF vectorial con las fuentes: se elige "Guardar como PDF" en el diálogo de impresión
  const hoja = armarHoja(); if (!hoja) return;
  $t('hoja-impresion').innerHTML = hoja.svg;
  $t('estilo-pagina').textContent = `@page { size: ${hoja.W}pt ${hoja.H}pt; margin: 0; } @media print { #hoja-impresion svg { display: block; width: ${hoja.W}pt; height: ${hoja.H}pt; } }`;
  window.print();
});

// --- MÓDULO 6: SECCIONES E INICIO ----------------------------------------------------------------------------------
function irASeccion(nombre) {
  document.body.dataset.seccion = nombre;
  document.querySelectorAll('.seccion').forEach(b => b.setAttribute('aria-current', b.dataset.seccion === nombre ? 'page' : 'false'));
  if (nombre === 'tipografia') { $t('tipo-base').value = tipo.base; $t('tipo-cuerpo').value = tipo.cuerpo; $t('tipo-razon').value = String(tipo.razon); pintarNiveles(); }
  window.scrollTo({ top: 0 });
}
document.querySelectorAll('.seccion').forEach(b => b.addEventListener('click', () => irASeccion(b.dataset.seccion)));
irASeccion('grilla');
