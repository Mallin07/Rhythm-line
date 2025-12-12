const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const feedbackEl = document.getElementById('feedback');
const startBtn = document.getElementById('startBtn');

// ==========================
// BOTÓN VOLVER A INICIACIÓN
// ==========================
const backBtn = document.getElementById('backBtn');

if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = '../Iniciacion.html';
  });
}

// ==========================
// 🎵 TEMPO / RITMO
// ==========================
const BPM = 60;                       // ----------------------------------------------------------------------------------------------tempo del juego
const BEAT_MS = 60000 / BPM;          // duración de un pulso en ms (1000ms a 60BPM)

// Duración de cada figura en milisegundos
const DURATION = {
  redonda: 4 * BEAT_MS,     // 4 pulsos
  blanca:  2 * BEAT_MS,     // 2 pulsos
  negra:   BEAT_MS,         // 1 pulso
  corchea: BEAT_MS / 2      // 0.5 pulso
};

// Tiempo que tarda la nota en viajar hasta la barra
const TRAVEL_TIME = 5 * BEAT_MS;      // 5 pulsos a 60BPM

// Configuración del juego
const HIT_X = 300; //----------------------------------------------------------------------------------------------Distancia barra del tiempo--------------//
const MISS_WINDOW = 250;
const PERFECT_WINDOW = 80;
const GOOD_WINDOW = 150;

const METRONOME_LEAD_MS = 45; // ...................................................................................Ajuste metronomo........................//

const VISIBLE_AFTER_MS = 2 * BEAT_MS;  // la nota sigue visible 2 tiempos después de la barra

const SPAWN_X = canvas.width - 40;
const LANE_Y = canvas.height / 2;

// dejamos el compás un poco a la izquierda de la barra
const TIME_SIGNATURE_X = HIT_X - 250;   // -----------------------------------------------------------------------Distancia signo compás-----------------------------//

// Tamaño base de las figuras
const NOTE_SIZE = 50;          // pruébalo; si lo quieres más grande, sube a 48

// Parámetros de dibujo de corcheas basados en NOTE_SIZE
const NOTE_HEAD_RX = NOTE_SIZE * 0.20;  //.....Anchura
const NOTE_HEAD_RY = NOTE_SIZE * 0.15;  //......Altura
const STEM_HEIGHT  = NOTE_SIZE * 0.80;
const NOTE_OFFSET_Y = -NOTE_SIZE * 0.17; // levanta un poco la nota sobre la línea


// ==========================
// 🎼 PATRÓN 
// ==========================
// Ahora además puedes usar beamToNext: true para unir corcheas con barra
const pattern = [
  // Compás 1
  { type: 'corchea'}, 
  { type: 'corchea' },                 
  { type: 'negra', tieToNext: true },   // ligadura de negras
  { type: 'negra' },
  { type: 'negra' },
  // Compás 2
  { type: 'corchea', beamToNext: true }, // corcheas unidas
  { type: 'corchea' },
  { type: 'corchea', beamToNext: true },
  { type: 'corchea', beamToNext: true },
  { type: 'corchea', beamToNext: true },
  { type: 'corchea' },
  { type: 'corchea' },
  { type: 'corchea' },
];

// La primera nota llega a la barra en el BEAT 4
const FIRST_NOTE_BEAT = 4;  //-----------------------------------------------------------------------------------Notas antes del primer tiempo................//

// Generamos la canción: array de { time, type, tieToNext, beamToNext }
const song = (() => {
  let currentTime = FIRST_NOTE_BEAT * BEAT_MS;
  const result = [];

  for (const p of pattern) {
    const { type, tieToNext, beamToNext } = typeof p === 'string'
      ? { type: p, tieToNext: false, beamToNext: false }
      : p;

    result.push({
      time: currentTime,
      type,
      tieToNext: !!tieToNext,
      beamToNext: !!beamToNext
    });

    currentTime += DURATION[type];
  }

  return result;
})();

// ==========================
// 🏅 MEDALLAS
// ==========================
const MAX_SCORE = pattern.length * 300; // todo PERFECT
const MEDAL_STORAGE_KEY = 'rhythmline_iniciacion_redondasyblancas_medal';

const MEDAL_RANK = {
  bronce: 1,
  plata: 2,
  oro: 3
};

function getMedal(score) {
  const ratio = score / MAX_SCORE; // 0–1

  if (ratio >= 0.9) return 'oro';
  if (ratio >= 0.6) return 'plata';
  if (ratio >= 0.3) return 'bronce';
  return null;
}

function saveBestMedal(newMedal) {
  if (!newMedal) return;

  const current = localStorage.getItem(MEDAL_STORAGE_KEY);
  if (!current) {
    localStorage.setItem(MEDAL_STORAGE_KEY, newMedal);
    return;
  }

  if (MEDAL_RANK[newMedal] > MEDAL_RANK[current]) {
    localStorage.setItem(MEDAL_STORAGE_KEY, newMedal);
  }
}

// ==========================
// 🎚 COMPASES / BARRAS
// ==========================
const BEATS_PER_BAR = 4;
const BAR_LEAD_MS = 150;

const bars = (() => {
  const result = [];
  const lastTime = song[song.length - 1].time;
  const barDuration = BEATS_PER_BAR * BEAT_MS;

  const firstNoteTime = song[0].time;
  const firstBarTime = Math.max(0, firstNoteTime - BAR_LEAD_MS);

  for (let t = firstBarTime; t <= lastTime + 2 * barDuration; t += barDuration) {
    result.push(t);
  }

  return result;
})();

let notes = [];
let running = false;
let startTime = null;
let score = 0;
let combo = 0;

// ==========================
// AUDIO GLOBAL
// ==========================
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// ==========================
// FIGURAS MUSICALES EN CANVAS
// ==========================

// Negra = cabeza rellena + plica
function drawNegra(x, y, hit) {
  const color = hit ? '#22c55e' : '#38bdf8';
  const yCenter = y + NOTE_OFFSET_Y;

  ctx.save();

  // Cabeza rellena
  ctx.beginPath();
  ctx.ellipse(
    x,
    yCenter,
    NOTE_HEAD_RX,
    NOTE_HEAD_RY,
    -0.4,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = color;
  ctx.fill();

  // Plica hacia arriba
  const xStem = x + NOTE_HEAD_RX - 2;
  const yBottom = yCenter;
  const yTop = yBottom - STEM_HEIGHT;

  ctx.beginPath();
  ctx.moveTo(xStem, yBottom);
  ctx.lineTo(xStem, yTop);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.restore();
}

// Blanca = cabeza vacía + plica
function drawBlanca(x, y, hit) {
  const color = hit ? '#22c55e' : '#38bdf8';
  const yCenter = y + NOTE_OFFSET_Y;

  ctx.save();

  // Cabeza vacía
  ctx.beginPath();
  ctx.ellipse(
    x,
    yCenter,
    NOTE_HEAD_RX,
    NOTE_HEAD_RY,
    -0.4,
    0,
    Math.PI * 2
  );
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();

  // Plica hacia arriba
  const xStem = x + NOTE_HEAD_RX - 2;
  const yBottom = yCenter;
  const yTop = yBottom - STEM_HEIGHT;

  ctx.beginPath();
  ctx.moveTo(xStem, yBottom);
  ctx.lineTo(xStem, yTop);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.restore();
}

// Redonda = cabeza vacía sin plica
function drawRedonda(x, y, hit) {
  const color = hit ? '#22c55e' : '#38bdf8';
  const yCenter = y + NOTE_OFFSET_Y;

  ctx.save();

  ctx.beginPath();
  ctx.ellipse(
    x,
    yCenter,
    NOTE_HEAD_RX,
    NOTE_HEAD_RY,
    -0.4,
    0,
    Math.PI * 2
  );
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.restore();
}

// ---- Corcheas (cabeza + plica) ----
function drawCorcheaBase(x, y, hit) {
  const color = hit ? '#22c55e' : '#38bdf8';
  const yCenter = y + NOTE_OFFSET_Y;

  ctx.save();

  // Cabeza
  ctx.beginPath();
  ctx.ellipse(x, yCenter, NOTE_HEAD_RX, NOTE_HEAD_RY, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Plica hacia arriba
  const xStem = x + NOTE_HEAD_RX - 2;
  const yBottom = yCenter;
  const yTop = yBottom - STEM_HEIGHT;

  ctx.beginPath();
  ctx.moveTo(xStem, yBottom);
  ctx.lineTo(xStem, yTop);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.restore();
}

// Punta de la plica (para beams / banderines)
function getCorcheaStemTop(x, y) {
  const yCenter = y + NOTE_OFFSET_Y;
  const xStem = x + NOTE_HEAD_RX - 2;
  const yTop = yCenter - STEM_HEIGHT;
  return { x: xStem, y: yTop };
}

function drawCorcheaFlag(xStem, yTop, hit) {  //........Cola de las corcheas
  const color = hit ? '#22c55e' : '#38bdf8';

  // Escala basada en el tamaño de la nota
  const flagWidth = NOTE_SIZE * 0.25;   // largo horizontal
  const flagHeight = NOTE_SIZE * 0.35;  // caída vertical

  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = NOTE_SIZE * 0.05;  // grosor proporcional

  ctx.moveTo(xStem, yTop);
  ctx.quadraticCurveTo(
    xStem + flagWidth, 
    yTop + flagHeight * 0.2, 
    xStem + flagWidth * 0.3, 
    yTop + flagHeight
  );

  ctx.stroke();
  ctx.restore();
}


function drawCorcheaBeam(x1Stem, x2Stem, yTop, hit) {
  const color = hit ? '#22c55e' : '#38bdf8';

  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.moveTo(x1Stem, yTop);
  ctx.lineTo(x2Stem, yTop);
  ctx.stroke();
  ctx.restore();
}

// ---- Figuras genéricas (router por tipo) ----
function drawNoteFigure(x, y, type, hit) {
  // Corchea: cabeza + plica; beams/banderines se dibujan después
  if (type === 'corchea') {
    drawCorcheaBase(x, y, hit);
    return;
  }

  // Negra
  if (type === 'negra') {
    drawNegra(x, y, hit);
    return;
  }

  // Blanca
  if (type === 'blanca') {
    drawBlanca(x, y, hit);
    return;
  }

  // Redonda
  if (type === 'redonda') {
    drawRedonda(x, y, hit);
    return;
  }

  // Cualquier otro tipo raro (doble, etc.) -> fallback con símbolo
  let symbol = '♩';
  if (type === 'doble') symbol = '♫';

  ctx.font = `${NOTE_SIZE}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = hit ? '#22c55e' : '#38bdf8';
  ctx.fillText(symbol, x, y + NOTE_OFFSET_Y);
}

// Ligaduras
function drawTie(x1, x2, baseY) {
  const midX = (x1 + x2) / 2;
  const h = 10;

  ctx.save();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(x1, baseY);
  ctx.quadraticCurveTo(midX, baseY + h, x2, baseY);
  ctx.stroke();

  ctx.restore();
}

// ----------------------
// 🎵 METRÓNOMO 60 BPM
// ----------------------
const FIRST_BEAT_TIME = 0;
let nextBeatTime = null;

function startMetronome() {
  initAudio();
  nextBeatTime = FIRST_BEAT_TIME;
}

function stopMetronome() {
  nextBeatTime = null;
}

function handleMetronome(elapsed) {
  if (!audioCtx || nextBeatTime === null) return;

  // adelantamos un poco el disparo del click
  while (elapsed + METRONOME_LEAD_MS >= nextBeatTime) {
    playClick();
    nextBeatTime += BEAT_MS;
  }
}

// ----------------------
// 🔊 SONIDOS DE HIT / MISS
// ----------------------
function playHitSound(isPerfect) {
  initAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.value = isPerfect ? 880 : 660;

  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.18);
}

function playMissSound() {
  initAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.value = 220;

  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.22);
}

function playClick() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'square';
  osc.frequency.value = 1000;

  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.60, now);  //------------------------------------------------------------------------ volumen metronomo--------------------------// 
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.06);
}

// ==========================
// DIBUJO ESTÁTICO: LÍNEA Y COMPÁS
// ==========================
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawStaticLane() {
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(40, LANE_Y);
  ctx.lineTo(canvas.width - 40, LANE_Y);
  ctx.stroke();

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(HIT_X, LANE_Y - 40);
  ctx.lineTo(HIT_X, LANE_Y + 40);
  ctx.stroke();
}

function drawTimeSignature() {
  ctx.save();

  ctx.fillStyle = '#e5e7eb';
  ctx.font = '28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText('4', TIME_SIGNATURE_X, LANE_Y - 16);
  ctx.fillText('4', TIME_SIGNATURE_X, LANE_Y + 16);

  ctx.restore();
}

// ==========================
// LÓGICA DEL JUEGO
// ==========================
function createNotes() {
  return song.map((n, index) => {
    const tiedFromPrev  = index > 0 && song[index - 1].tieToNext;
    const beamFromPrev  = index > 0 && song[index - 1].beamToNext; // 👈 nuevo

    return {
      hitTime: n.time,
      type: n.type,
      tieToNext: n.tieToNext || false,
      beamToNext: n.beamToNext || false, // 👈 ya lo teníamos en song
      beamFromPrev,                      // 👈 nuevo
      tiedFromPrev,                      // true = recibe ligadura
      judgementNote: !tiedFromPrev,      // solo se juzgan las que NO reciben ligadura
      hit: false,
      missed: false,
      currentX: null,
      visible: false,
      index
    };
  });
}


function resetGame() {
  score = 0;
  combo = 0;
  notes = createNotes();
  running = false;
  startTime = null;
  scoreEl.textContent = score;
  comboEl.textContent = combo;
  setFeedback('', null);
  clearCanvas();
  drawStaticLane();
  drawTimeSignature();
  stopMetronome();
}

function setFeedback(text, type) {
  feedbackEl.textContent = text;
  feedbackEl.className = '';
  if (type) feedbackEl.classList.add(type);
}

function drawNotes(timestamp) {
  if (!running) return;

  const elapsed = timestamp - startTime;

  handleMetronome(elapsed);

  clearCanvas();
  drawStaticLane();
  drawTimeSignature();

  const distance = SPAWN_X - HIT_X;

  // limpiar flags de visibilidad
  for (const note of notes) {
    note.visible = false;
    // currentX se conserva
  }

  // --------- NOTAS -----------
  for (const note of notes) {
    const timeToHit = note.hitTime - elapsed;

    if (
      timeToHit < -MISS_WINDOW &&
      !note.hit &&
      !note.missed &&
      note.judgementNote
    ) {
      note.missed = true;
      combo = 0;
      comboEl.textContent = combo;
      setFeedback('FALLO', 'miss');
      playMissSound();
    }

    if (timeToHit <= TRAVEL_TIME && timeToHit >= -VISIBLE_AFTER_MS) {
  const fraction = timeToHit / TRAVEL_TIME;
  const x = HIT_X + distance * fraction;

  note.currentX = x;
  note.visible = true;

  drawNoteFigure(x, LANE_Y, note.type, note.hit);
  }
  }

  // --------- BARRAS / BANDERINES DE CORCHEAS ---------

// 1 Beams manuales con beamToNext
for (let i = 0; i < notes.length - 1; i++) {
  const n1 = notes[i];
  const n2 = notes[i + 1];

  if (!n1.beamToNext) continue;
  if (!n2.visible) continue;
  if (n1.currentX == null || n2.currentX == null) continue;

  const stem1 = getCorcheaStemTop(n1.currentX, LANE_Y);
  const stem2 = getCorcheaStemTop(n2.currentX, LANE_Y);
  const yBeam = Math.min(stem1.y, stem2.y) - 3;
  const hitBoth = n1.hit && n2.hit;

  // 👉 SIN CLIP: la barra une siempre las dos plicas
  drawCorcheaBeam(stem1.x, stem2.x, yBeam, hitBoth);
}


  // 2) BANDERINES para corcheas que no pertenecen a ningún beam
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (!n.visible) continue;
    if (n.type !== 'corchea') continue;

    // si está en un grupo de barra (con anterior o siguiente), no lleva banderín
    if (n.beamFromPrev || n.beamToNext) continue;

    const stem = getCorcheaStemTop(n.currentX, LANE_Y);
    drawCorcheaFlag(stem.x, stem.y, n.hit);
  }

  // --------- LIGADURAS ENTRE NOTAS CON tieToNext ---------
  const tieBaseY = LANE_Y + 22; // un poco por debajo de la línea

  for (let i = 0; i < notes.length - 1; i++) {
    const n1 = notes[i];
    const n2 = notes[i + 1];

    if (!n1.tieToNext) continue;
    if (!n2.visible) continue;
    if (n1.currentX == null || n2.currentX == null) continue;

    ctx.save();
    ctx.beginPath();
    ctx.rect(HIT_X, 0, canvas.width - HIT_X, canvas.height);
    ctx.clip();

    drawTie(n1.currentX, n2.currentX, tieBaseY);

    ctx.restore();
  }

  // --------- BARRAS DE COMPÁS -----------
for (const barTime of bars) {
  const timeToBar = barTime - elapsed;

  if (timeToBar <= TRAVEL_TIME && timeToBar >= -MISS_WINDOW) {
    const fraction = timeToBar / TRAVEL_TIME;
    const x = HIT_X + distance * fraction;

    ctx.save();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    ctx.beginPath();
    ctx.moveTo(x, LANE_Y - 60);
    ctx.lineTo(x, LANE_Y + 60);
    ctx.stroke();

    ctx.restore();
  }
}

  const lastTime = song[song.length - 1].time;
  const allProcessed = notes.every(n => !n.judgementNote || n.hit || n.missed);

  if (allProcessed && elapsed > lastTime + 1500) {
    running = false;
    stopMetronome();

    const medal = getMedal(score);
    saveBestMedal(medal);

    if (medal === 'oro') {
      setFeedback('🥇 ¡Medalla de ORO! ¡Excelente trabajo!', 'medal-oro');
    } else if (medal === 'plata') {
      setFeedback('🥈 Medalla de PLATA. ¡Muy bien!', 'medal-plata');
    } else if (medal === 'bronce') {
      setFeedback('🥉 Medalla de BRONCE. ¡Sigue practicando!', 'medal-bronce');
    } else {
      setFeedback('Has terminado. ¡Intenta conseguir una medalla!', null);
    }

    return;
  }

  requestAnimationFrame(drawNotes);
}

// Estado del botón: 'start' (Empezar) o 'restart' (Reiniciar)
startBtn.dataset.mode = 'start';  // estado inicial

function startRun() {
  running = true;
  startTime = performance.now();
  startMetronome();
  requestAnimationFrame(drawNotes);
}

startBtn.addEventListener('click', () => {
  const mode = startBtn.dataset.mode;

  if (mode === 'restart') {
    resetGame();
    startBtn.textContent = 'Empezar';
    startBtn.dataset.mode = 'start';
  } else {
    resetGame();
    startRun();
    startBtn.textContent = 'Reiniciar';
    startBtn.dataset.mode = 'restart';
  }
});

function handleHit() {
  if (!running || !startTime) return;

  const now = performance.now();
  const elapsed = now - startTime;

  let bestNote = null;
  let bestDelta = Infinity;

  for (const note of notes) {
    if (!note.judgementNote) continue;
    if (note.hit || note.missed) continue;

    const delta = Math.abs(note.hitTime - elapsed);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestNote = note;
    }
  }

  if (!bestNote || bestDelta > GOOD_WINDOW) {
    combo = 0;
    comboEl.textContent = combo;
    setFeedback('FALLO', 'miss');
    playMissSound();
    return;
  }

  bestNote.hit = true;

  if (bestDelta <= PERFECT_WINDOW) {
    score += 300;
    combo++;
    setFeedback('PERFECT', 'perfect');
    playHitSound(true);
  } else {
    score += 100;
    combo++;
    setFeedback('BIEN', 'good');
    playHitSound(false);
  }

  scoreEl.textContent = score;
  comboEl.textContent = combo;
}

// ==========================
// EVENTOS
// ==========================

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === 'j' || e.key === 'J') {
    e.preventDefault();
    handleHit();
  }
});

// --- soporte móvil ---
const hitBtn = document.getElementById('hitBtn');

if (hitBtn) {
  hitBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleHit();
  });

  hitBtn.addEventListener('click', () => {
    handleHit();
  });
}

// primer dibujo en reposo
resetGame();

