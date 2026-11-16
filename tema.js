/* =====================================================================================
   TEMA CLARO / OSCURO
   Sigue el tema del sistema la primera vez; después recuerda la elección.
   ===================================================================================== */

// --- MÓDULO 1: ELEGIR Y APLICAR EL TEMA ---------------------------------------------------
(function () {
  const CLAVE = 'estudioGrilla.tema';
  let tema;
  try { tema = localStorage.getItem(CLAVE); } catch (e) { /* sin guardado */ }
  if (tema !== 'claro' && tema !== 'oscuro') tema = matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  document.documentElement.dataset.tema = tema;

// --- MÓDULO 2: BOTÓN PARA CAMBIAR ----------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    const boton = document.createElement('button');
    boton.type = 'button'; boton.className = 'boton-tema';
    const actualizar = () => {
      const etiqueta = tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro';
      boton.innerHTML = `<span aria-hidden="true">${tema === 'oscuro' ? '☀' : '☾'}</span><span class="etiqueta-tema">${etiqueta}</span>`;
      boton.setAttribute('aria-label', etiqueta);
    };
    boton.addEventListener('click', () => {
      tema = tema === 'oscuro' ? 'claro' : 'oscuro';
      document.documentElement.dataset.tema = tema;
      try { localStorage.setItem(CLAVE, tema); } catch (e) { /* sin guardado */ }
      actualizar();
    });
    actualizar();
    (document.querySelector('.acciones-superiores') || document.querySelector('.cabecera')).appendChild(boton);
  });
})();
