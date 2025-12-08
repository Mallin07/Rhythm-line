const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const stateEl = document.getElementById('state');
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
const BPM = 60;                       // tempo del juego
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
const HIT_X = 120;
const MISS_WINDOW = 250;
const PERFECT_WINDOW = 80;
const GOOD_WINDOW = 150;

const SPAWN_X = canvas.width - 40;
const LANE_Y = canvas.height / 2;
const TIME_SIGNATURE_X = 60;   // posición del 4/4

// ==========================
// 🎼 PATRÓN (SOLO REDONDAS)
// ==========================
const pattern = [
  'blanca',
  'blanca',
  'blanca',
  'blanca',
  'blanca',
  'blanca',
  'blanca',
  'blanca'
];

// (comentario antiguo de BEAT 2, ahora usas 4)
// La primera nota llega a la barra en el BEAT 4
const FIRST_NOTE_BEAT = 4;

// Generamos la canción: array de { time, type }
const song = (() => {
  let currentTime = FIRST_NOTE_BEAT * BEAT_MS;
  const result = [];

  for (const type of pattern) {
    result.push({ time: currentTime, type });
    currentTime += DURATION[type];
  }

  return result;
})();

// ==========================
// 🏅 MEDALLAS
// ==========================
const MAX_SCORE = pattern.length * 300; // todo PERFECT
const MEDAL_STORAGE_KEY = 'rhythmline_iniciacion_blancas_medal';

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
function drawNoteFigure(x, y, type, hit) {
  let symbol = '♩';
  if (type === 'corchea') symbol = '♪';
  if (type === 'doble')   symbol = '♫';
  if (type === 'blanca')  symbol = '𝅗𝅥';
  if (type === 'redonda') symbol = '𝅝';

  ctx.font = '48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = hit ? '#22c55e' : '#38bdf8';
  ctx.fillText(symbol, x, y);
}

// ----------------------
// 🎵 METRÓNOMO 60 BPM
// ----------------------
const FIRST_BEAT_TIME = 0;
let nextBeatTime = null;

function playClick() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'square';
  osc.frequency.value = 1000;

  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.06);
}

function startMetronome() {
  initAudio();
  nextBeatTime = FIRST_BEAT_TIME;
}

function stopMetronome() {
  nextBeatTime = null;
}

function handleMetronome(elapsed) {
  if (!audioCtx || nextBeatTime === null) return;

  while (elapsed >= nextBeatTime) {
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

  // Número superior (4)
  ctx.fillText('4', TIME_SIGNATURE_X, LANE_Y - 16);
  // Número inferior (4)
  ctx.fillText('4', TIME_SIGNATURE_X, LANE_Y + 16);

  ctx.restore();
}

// ==========================
// LÓGICA DEL JUEGO
// ==========================
function createNotes() {
  return song.map(n => ({
    hitTime: n.time,
    type: n.type,
    hit: false,
    missed: false
  }));
}

function resetGame() {
  score = 0;
  combo = 0;
  notes = createNotes();
  running = false;
  startTime = null;
  scoreEl.textContent = score;
  comboEl.textContent = combo;
  stateEl.textContent = 'Parado';
  setFeedback('', null);
  clearCanvas();
  drawStaticLane();
  drawTimeSignature();   // también cuando está parado
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
  drawTimeSignature();   // dibujamos el 4/4

  const distance = SPAWN_X - HIT_X;

  // --------- NOTAS -----------
  for (const note of notes) {
    const timeToHit = note.hitTime - elapsed;

    if (timeToHit < -MISS_WINDOW && !note.hit && !note.missed) {
      note.missed = true;
      combo = 0;
      comboEl.textContent = combo;
      setFeedback('FALLO', 'miss');
      playMissSound();
    }

    if (timeToHit <= TRAVEL_TIME && timeToHit >= -MISS_WINDOW) {
      const fraction = timeToHit / TRAVEL_TIME;
      const x = HIT_X + distance * fraction;

      drawNoteFigure(x, LANE_Y, note.type, note.hit);
    }
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
  const allProcessed = notes.every(n => n.hit || n.missed);

  if (allProcessed && elapsed > lastTime + 1500) {
    running = false;
    stateEl.textContent = 'Fin';
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

function startGame() {
  resetGame();
  running = true;
  stateEl.textContent = 'Jugando';
  startTime = performance.now();

  startMetronome();
  requestAnimationFrame(drawNotes);
}

function handleHit() {
  if (!running || !startTime) return;

  const now = performance.now();
  const elapsed = now - startTime;

  let bestNote = null;
  let bestDelta = Infinity;

  for (const note of notes) {
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
startBtn.addEventListener('click', startGame);

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === 'j' || e.key === 'J') {
    e.preventDefault();
    handleHit();
  }
});

// primer dibujo en reposo
resetGame();
