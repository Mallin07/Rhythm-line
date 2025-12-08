// ==========================
// BOTÓN VOLVER AL MENÚ
// ==========================
document.getElementById('back-to-menu').addEventListener('click', () => {
  window.location.href = '../../index.html';
});

// ==========================
// 🏅 MEDALLAS (emoji)
// ==========================
const MEDAL_EMOJI = {
  oro: '🥇',
  plata: '🥈',
  bronce: '🥉'
};

// ==========================
// 📁 RUTAS DE LOS NIVELES
// ==========================
const LEVEL_PATHS = {
  redondas: 'Redondas/Redondas.html',
  // cuando crees más carpetas:
  blancas: 'blancas/blancas.html',
  redondasyblancas: 'redondasyblancas/redondasyblancas.html',
  // negras: 'Negras/Negras.html',
  // corcheas: 'Corcheas/Corcheas.html'
};

// ==========================
// BOTONES DE NIVELES
// ==========================
document.querySelectorAll('.btn-level').forEach(btn => {
  const level = btn.dataset.level; // redondas, blancas...

  // ---------- Mostrar medalla ----------
  const storageKey = `rhythmline_iniciacion_${level}_medal`;
  const medal = localStorage.getItem(storageKey);

  if (medal && MEDAL_EMOJI[medal]) {
    const span = document.createElement('span');
    span.className = 'medal-icon';
    span.textContent = MEDAL_EMOJI[medal];
    btn.appendChild(span);
  }

  // ---------- Navegación ----------
  btn.addEventListener('click', () => {
    const path = LEVEL_PATHS[level];
    if (path) {
      window.location.href = path;
    } else {
      alert('Este nivel todavía no está disponible 🙂');
    }
  });
});
