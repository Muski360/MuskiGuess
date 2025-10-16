let gameId = null;
let attempts = 0;
let maxAttempts = 6;
let currentCol = 0;
let secretRevealed = false;
let currentLang = 'pt';

const appRoot = document.getElementById('appRoot');
const board = document.getElementById('board');
const statusEl = document.getElementById('status');
const newGameBtn = document.getElementById('newGameBtn');
const overlay = document.getElementById('overlay');
const correctWordEl = document.getElementById('correctWord');
const playAgainBtn = document.getElementById('playAgainBtn');
const toast = document.getElementById('toast');
const confettiCanvas = document.getElementById('confettiCanvas');
const ctx = confettiCanvas.getContext('2d');
const winOverlay = document.getElementById('winOverlay');
const winAttemptsEl = document.getElementById('winAttempts');
const winPlayAgainBtn = document.getElementById('winPlayAgainBtn');
const langOverlay = document.getElementById('langOverlay');
const langPtBtn = document.getElementById('langPt');
const langEnBtn = document.getElementById('langEn');
const themeToggle = document.getElementById('themeToggle');
const helpBtn = document.getElementById('helpBtn');
const helpOverlay = document.getElementById('helpOverlay');
const helpCloseBtn = document.getElementById('helpCloseBtn');
const helpTitle = document.getElementById('helpTitle');
const helpGray = document.getElementById('helpGray');
const helpYellow = document.getElementById('helpYellow');
const helpGreen = document.getElementById('helpGreen');
const helpTries = document.getElementById('helpTries');
const newGameBtnEl = document.getElementById('newGameBtn');
const hintEl = document.querySelector('.hint');
const gameOverTitleEl = document.querySelector('#overlay .modal h2');
const gameOverTextEl = document.querySelector('#overlay .modal p');
const playAgainBtnEl = document.getElementById('playAgainBtn');
const toastEl = document.getElementById('toast');
const winTitleEl = document.querySelector('#winOverlay .modal h2');
const winTextPrefixEl = document.querySelector('#winOverlay .modal p');
const winPlayAgainBtnEl = document.getElementById('winPlayAgainBtn');

function resizeCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

function renderBoard() {
  board.innerHTML = '';
  for (let r = 0; r < maxAttempts; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    for (let c = 0; c < 5; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.disabled = r !== attempts;
      input.tabIndex = r === attempts ? (c + 1) : -1;
      input.addEventListener('input', () => onInput(r, c, input));
      input.addEventListener('keydown', (e) => onKeyDown(e, r, c, input));
      cell.appendChild(input);
      row.appendChild(cell);
    }
    board.appendChild(row);
  }
  focusCell(attempts, 0);
}

function setStatus(text) { statusEl.textContent = text; }

async function newGame() {
  const res = await fetch('/api/new-game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: currentLang }) });
  if (!res.ok) { setStatus('Erro ao criar novo jogo'); return; }
  const data = await res.json();
  gameId = data.gameId;
  attempts = 0;
  maxAttempts = data.maxAttempts;
  currentCol = 0;
  secretRevealed = false;
  renderBoard();
  setStatus(currentLang === 'en' ? 'New game started!' : 'Novo jogo iniciado!');
  hideOverlay();
  toast.classList.add('hidden');
  confettiCanvas.classList.add('hidden');
  document.title = 'MuskiGuess';
}

function getRowInputs(rowIndex) {
  return Array.from(board.children[rowIndex].querySelectorAll('input'));
}

function onInput(r, c, input) {
  input.value = input.value.toUpperCase().replace(/[^A-ZÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ]/g, '');
  if (input.value && c < 4) {
    focusCell(r, c + 1);
  }
  // verifica segredo "BILLY" na linha ativa
  maybeRevealSecret(r);
}

function onKeyDown(e, r, c, input) {
  if (e.key === 'Backspace') {
    if (input.value) {
      input.value = '';
      return;
    }
    if (c > 0) focusCell(r, c - 1);
  } else if (e.key === 'ArrowLeft') {
    if (c > 0) focusCell(r, c - 1);
  } else if (e.key === 'ArrowRight') {
    if (c < 4) focusCell(r, c + 1);
  } else if (e.key === 'Enter') {
    submitCurrentRow();
  }
}

function focusCell(r, c) {
  currentCol = c;
  const rowInputs = getRowInputs(r);
  rowInputs.forEach((inp, idx) => {
    const cell = inp.parentElement;
    cell.classList.toggle('active', idx === c);
  });
  rowInputs[c].focus();
}

function readGuessFromRow(r) {
  return getRowInputs(r).map(i => (i.value || '').toLowerCase()).join('');
}

function maybeRevealSecret(r) {
  if (r !== attempts || secretRevealed) return;
  const val = readGuessFromRow(r).toUpperCase();
  if (val === 'BILLY') {
    revealSecretTitle();
  }
}

async function revealSecretTitle() {
  try {
    if (!gameId) return;
    const res = await fetch(`/api/peek?gameId=${encodeURIComponent(gameId)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.correctWord) {
      document.title = data.correctWord;
      secretRevealed = true;
    }
  } catch (e) {
    // silencioso
  }
}

async function submitCurrentRow() {
  if (!gameId) { setStatus('Clique em Novo jogo'); return; }
  const guess = readGuessFromRow(attempts);
  if (!/^[a-zA-Zçãõáéíóúàèìòùâêîôû]{5}$/.test(guess)) {
    setStatus(currentLang === 'en' ? 'Fill all 5 letters before sending.' : 'Complete as 5 letras antes de enviar.');
    return;
  }
  await sendGuess(guess);
}

async function sendGuess(guess) {
  const res = await fetch('/api/guess', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, guess })
  });
  const data = await res.json();
  if (!res.ok) { setStatus(data.error || 'Erro ao enviar palpite'); return; }

  const row = board.children[attempts];
  await revealRowWithAnimation(row, data.feedback);

  attempts = data.attempts;
  if (data.won) {
    setStatus('Parabéns!');
    showWinEffects();
    showWinOverlay(data.attempts);
  } else if (data.gameOver) {
    setStatus('Fim de jogo!');
    showOverlay(data.correctWord || '');
  } else {
    enableNextRow();
    setStatus(currentLang === 'en' ? `Attempt ${attempts + 1} of ${maxAttempts}` : `Tentativa ${attempts + 1} de ${maxAttempts}`);
  }
}

async function revealRowWithAnimation(row, feedback) {
  for (let idx = 0; idx < 5; idx++) {
    const cell = row.children[idx];
    const input = cell.querySelector('input');
    // suspense: inicia flip
    cell.classList.add('revealing');
    await new Promise(r => setTimeout(r, 150));
    // metade do flip: aplica letra e estado
    input.value = feedback[idx].letter;
    input.disabled = true;
    input.tabIndex = -1;
    cell.classList.add(feedback[idx].status);
    cell.classList.remove('active');
    await new Promise(r => setTimeout(r, 150));
    cell.classList.remove('revealing');
  }
}

function enableNextRow() {
  const nextRowInputs = getRowInputs(attempts);
  nextRowInputs.forEach((inp, idx) => { inp.disabled = false; inp.tabIndex = idx + 1; inp.value = ''; });
  focusCell(attempts, 0);
}

function showOverlay(correctWord) {
  correctWordEl.textContent = correctWord;
  overlay.classList.remove('hidden');
  appRoot.classList.add('blurred');
}
function hideOverlay() {
  overlay.classList.add('hidden');
  appRoot.classList.remove('blurred');
}

function showWinOverlay(attemptCount) {
  winAttemptsEl.textContent = attemptCount;
  winOverlay.classList.remove('hidden');
  appRoot.classList.add('blurred');
}
function hideWinOverlay() {
  winOverlay.classList.add('hidden');
  appRoot.classList.remove('blurred');
}

function showToast() {
  toast.classList.remove('hidden');
  setTimeout(() => { toast.classList.add('hidden'); }, 1800);
}

function showWinEffects() {
  showToast();
  launchConfetti();
}

function launchConfetti() {
  resizeCanvas();
  confettiCanvas.classList.remove('hidden');
  const particles = Array.from({ length: 220 }).map(() => ({
    x: Math.random() * confettiCanvas.width,
    y: -20 - Math.random() * 200,
    r: 3 + Math.random() * 4,
    color: `hsl(${Math.random() * 360}, 90%, 60%)`,
    vy: 2 + Math.random() * 3,
    vx: -1 + Math.random() * 2,
    rot: Math.random() * Math.PI,
    vr: -0.1 + Math.random() * 0.2,
  }));
  function frame() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
      ctx.restore();
    });
    const allOffscreen = particles.every(p => p.y - p.r > confettiCanvas.height);
    if (!allOffscreen) requestAnimationFrame(frame);
    else confettiCanvas.classList.add('hidden');
  }
  requestAnimationFrame(frame);
}

newGameBtn.addEventListener('click', newGame);
playAgainBtn.addEventListener('click', () => { newGame(); });
winPlayAgainBtn.addEventListener('click', () => { hideWinOverlay(); newGame(); });

// Lang selection
function chooseLang(lang) {
  currentLang = lang;
  langOverlay.classList.add('hidden');
  applyLanguage();
  newGame();
}
langPtBtn.addEventListener('click', () => chooseLang('pt'));
langEnBtn.addEventListener('click', () => chooseLang('en'));

// Start: show language overlay
langOverlay.classList.remove('hidden');

// Theme toggle
let darkMode = true;
function applyTheme() {
  if (darkMode) {
    document.documentElement.style.setProperty('--bg', '#0f172a');
    document.documentElement.style.setProperty('--panel', '#111827');
    document.documentElement.style.setProperty('--text', '#0df2ff');
    document.documentElement.style.setProperty('--muted', '#9ca3af');
    document.documentElement.style.setProperty('--surface', '#0b1220');
    document.documentElement.style.setProperty('--border', '#1f2937');
    document.documentElement.style.setProperty('--button-bg', 'linear-gradient(180deg, #1f2937 0%, #0f172a 100%)');
    document.documentElement.style.setProperty('--button-border', '#1f2937');
    document.documentElement.style.setProperty('--toast-bg', '#16a34a');
    document.documentElement.style.setProperty('--toast-text', '#052e16');
    document.body.style.background = 'radial-gradient(1200px 600px at 10% 10%, #0b1225 0%, var(--bg) 60%)';
    themeToggle.textContent = '🌙';
  } else {
    // Light theme refined (clean, moderno)
    document.documentElement.style.setProperty('--bg', '#f5f7fb');
    document.documentElement.style.setProperty('--panel', '#ffffff');
    document.documentElement.style.setProperty('--text', '#0f172a');
    document.documentElement.style.setProperty('--muted', '#475569');
    document.documentElement.style.setProperty('--surface', '#ffffff');
    document.documentElement.style.setProperty('--border', '#e5e7eb');
    document.documentElement.style.setProperty('--button-bg', '#ffffff');
    document.documentElement.style.setProperty('--button-border', '#e5e7eb');
    document.documentElement.style.setProperty('--toast-bg', '#22c55e');
    document.documentElement.style.setProperty('--toast-text', '#052e16');
    document.body.style.background = 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)';
    themeToggle.textContent = '☀️';
  }
}
applyTheme();
themeToggle.addEventListener('click', () => { darkMode = !darkMode; applyTheme(); });

// Help modal
function updateHelpTexts() {
  if (currentLang === 'en') {
    helpBtn.textContent = 'How to play?';
    helpTitle.textContent = 'How to play';
    helpGray.textContent = 'The letter is not in the word.';
    helpYellow.textContent = 'The letter is in the word but wrong position.';
    helpGreen.textContent = 'The letter is in the correct position.';
    helpTries.textContent = 'You have 6 tries to guess the 5-letter word.';
  } else {
    helpBtn.textContent = 'Como jogar?';
    helpTitle.textContent = 'Como jogar';
    helpGray.textContent = 'A letra não existe na palavra.';
    helpYellow.textContent = 'A letra existe na palavra em outra posição.';
    helpGreen.textContent = 'A letra está na posição correta.';
    helpTries.textContent = 'Você tem 6 tentativas para adivinhar a palavra de 5 letras.';
  }
}
function applyLanguage() {
  document.documentElement.lang = currentLang === 'en' ? 'en' : 'pt-BR';
  updateHelpTexts();
  if (currentLang === 'en') {
    newGameBtnEl.textContent = 'New game';
    hintEl.textContent = 'Type directly in the squares. Good luck!';
    gameOverTitleEl.textContent = 'Game over';
    gameOverTextEl.childNodes[0].textContent = 'The correct word was: ';
    playAgainBtnEl.textContent = 'Play again';
    toastEl.textContent = 'Congrats! You got it!';
    winTitleEl.textContent = 'You won!';
    // winTextPrefixEl has: 'Acertou em ' + <span id="winAttempts"></span> + ' tentativas.'
    winTextPrefixEl.childNodes[0].textContent = 'Solved in ';
    // after span stays; we replace trailing text node after span
    if (winTextPrefixEl.childNodes.length > 2) {
      winTextPrefixEl.childNodes[2].textContent = ' tries.';
    }
    winPlayAgainBtnEl.textContent = 'Play again';
    board.setAttribute('aria-label', 'Game board');
  } else {
    newGameBtnEl.textContent = 'Novo jogo';
    hintEl.textContent = 'Digite diretamente nos quadrados. Boa sorte!';
    gameOverTitleEl.textContent = 'Fim de jogo';
    gameOverTextEl.childNodes[0].textContent = 'A palavra correta era: ';
    playAgainBtnEl.textContent = 'Jogar novamente';
    toastEl.textContent = 'Parabéns! Você acertou!';
    winTitleEl.textContent = 'Você acertou!';
    if (winTextPrefixEl.childNodes.length > 0) {
      winTextPrefixEl.childNodes[0].textContent = 'Acertou em ';
    }
    if (winTextPrefixEl.childNodes.length > 2) {
      winTextPrefixEl.childNodes[2].textContent = ' tentativas.';
    }
    board.setAttribute('aria-label', 'Tabuleiro do jogo');
  }
}
helpBtn.addEventListener('click', () => { updateHelpTexts(); helpOverlay.classList.remove('hidden'); appRoot.classList.add('blurred'); });
helpCloseBtn.addEventListener('click', () => { helpOverlay.classList.add('hidden'); appRoot.classList.remove('blurred'); });
