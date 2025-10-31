// Teste básico para verificar se o JavaScript está funcionando
console.log('JavaScript carregado!');

let gameId = null;
let attempts = 0;
let maxAttempts = 6;
let wordCount = 1; // 1 = single, >=2 = duet/multi
let gameMode = 'single'; // 'single' | 'duet' | 'quaplet'
let currentCol = 0;
let secretRevealed = false;
let currentLang = 'pt';
let isRevealing = false;
let muskiActivated = false;
let hackrActivated = false; // matrix rain background toggle
let isSubmitting = false; // evita duplo envio
let suppressAutoAdvance = false; // evita avanço duplo entre keydown e input

// Declarar variáveis do teclado ANTES das funções que as usam
const BACKSPACE_KEY = '\u232b';
const rows = [
  'QWERTYUIOP'.split(''),
  'ASDFGHJKL'.split(''),
  ['ENTER', ...'ZXCVBNM'.split(''), BACKSPACE_KEY]
];
let keyStatuses = {}; // letter -> { global: 'gray|yellow|green', perWord: { [index]: status } }
const KEY_STATUS_PRECEDENCE = { gray: 1, yellow: 2, green: 3 };
const DEFAULT_STATUS_COLORS = { gray: '#4b5563', yellow: '#eab308', green: '#22c55e' };

function hexToRgb(hex) {
  if (typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
  let normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized.split('').map(ch => ch + ch).join('');
  }
  const intVal = parseInt(normalized, 16);
  if (Number.isNaN(intVal)) return { r: 0, g: 0, b: 0 };
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
}
let keyColorPalette = { ...DEFAULT_STATUS_COLORS };

// In duet mode (wordCount > 1), keep track of which words have been solved. When a
// particular word has all letters marked green, we flag it here so that its
// input row is disabled on subsequent attempts. This array is reset on each
// new game based on the current wordCount. Index corresponds to the
// wordIndex (0-based) in the duet layout.
let solvedWords = [];
let solvedWordSnapshots = [];
let pendingAppMode = 'single';
if (document.body) {
  document.body.setAttribute('data-game-mode', pendingAppMode);
}


// Variáveis globais para elementos DOM
let appRoot, board, statusEl, newGameBtn, overlay, correctWordEl, playAgainBtn, toast, confettiCanvas, ctx;
let langOverlay, langPtBtn, langEnBtn, themeToggle;
let helpBtn, helpOverlay, helpCloseBtn, helpTitle, helpGray, helpYellow, helpGreen, helpTries;
let secretsBtn, secretsContent, secretsSectionTitle, secretsSectionText, secretMuskiTitle, secretMuskiText, secretBillyTitle, secretBillyText, secretHackrTitle, secretHackrText;
let newGameBtnEl, hintEl, gameOverTitleEl, gameOverTextEl, playAgainBtnEl, toastEl;
let keyboardEl, langWorldBtn;
let menuClassicBtn, menuDupletBtn, menuQuapletBtn, menuMultiplayerBtn;
let infoBtn, infoOverlay, infoCloseBtn, infoTitle, infoText, githubText;
let logoImage;
let activeSideOverlay = null;

// Routing helpers: reflect mode in URL and set mode from URL
function pathForMode(mode) {
  if (mode === 'duet') return '/duplet';
  if (mode === 'quaplet') return '/quaplet';
  return '/'; // classic
}

function setMenuActiveForMode(mode) {
  if (menuClassicBtn) menuClassicBtn.classList.toggle('active', mode === 'single');
  if (menuDupletBtn) menuDupletBtn.classList.toggle('active', mode === 'duet');
  if (menuQuapletBtn) menuQuapletBtn.classList.toggle('active', mode === 'quaplet');
}

function applyModeLayout(mode) {
  pendingAppMode = mode;
  if (appRoot) {
    appRoot.setAttribute('data-mode', mode);
  }
  if (document.body) {
    document.body.setAttribute('data-game-mode', mode);
  }
}

function updateURLForMode(mode, {push = true} = {}) {
  const path = pathForMode(mode);
  if (push && window.location.pathname !== path) {
    history.pushState({ mode }, '', path);
  }
}

function setMode(mode, {push = true, startNewGame = true} = {}) {
  if (!['single', 'duet', 'quaplet'].includes(mode)) mode = 'single';
  gameMode = mode;
  setMenuActiveForMode(mode);
  updateURLForMode(mode, { push });
  applyModeLayout(mode);
  if (startNewGame) newGame();
}

// Called by UI clicks
function setModeFromUI(mode) {
  setMode(mode, { push: true, startNewGame: true });
}

// Parse the current path and apply
function applyModeFromPath(pathname, {push = false, startNewGame = false} = {}) {
  let mode = 'single';
  const p = (pathname || '').toLowerCase();
  if (p === '/duplet' || p === '/duet') mode = 'duet';
  else if (p === '/quaplet') mode = 'quaplet';
  setMode(mode, { push, startNewGame });
}

// Função para inicializar elementos DOM
function initDOMElements() {
  appRoot = document.getElementById('appRoot');
  board = document.getElementById('board');
  if (appRoot) {
    appRoot.setAttribute('data-mode', pendingAppMode);
  }
  if (!board) {
    console.error('Board element not found in DOM!');
  }
  statusEl = document.getElementById('status');
  newGameBtn = document.getElementById('newGameBtn');
  overlay = document.getElementById('overlay');
  correctWordEl = document.getElementById('correctWord');
  playAgainBtn = document.getElementById('playAgainBtn');
  toast = document.getElementById('toast');
  confettiCanvas = document.getElementById('confettiCanvas');
  ctx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
  langOverlay = document.getElementById('langOverlay');
  langPtBtn = document.getElementById('langPt');
  langEnBtn = document.getElementById('langEn');
  themeToggle = document.getElementById('themeToggle');
  helpBtn = document.getElementById('helpBtn');
  helpOverlay = document.getElementById('helpOverlay');
  helpCloseBtn = document.getElementById('helpCloseBtn');
  helpTitle = document.getElementById('helpTitle');
  helpGray = document.getElementById('helpGray');
  helpYellow = document.getElementById('helpYellow');
  helpGreen = document.getElementById('helpGreen');
  helpTries = document.getElementById('helpTries');
  secretsBtn = document.getElementById('secretsBtn');
  secretsContent = document.getElementById('secretsContent');
  secretsSectionTitle = document.getElementById('secretsSectionTitle');
  secretsSectionText = document.getElementById('secretsSectionText');
  secretMuskiTitle = document.getElementById('secretMuskiTitle');
  secretMuskiText = document.getElementById('secretMuskiText');
  secretBillyTitle = document.getElementById('secretBillyTitle');
  secretBillyText = document.getElementById('secretBillyText');
  // Optional secret: HACKR (Matrix rain background)
  secretHackrTitle = document.getElementById('secretHackrTitle');
  secretHackrText = document.getElementById('secretHackrText');
  newGameBtnEl = document.getElementById('newGameBtn');
  hintEl = document.querySelector('.hint');
  logoImage = document.getElementById('logoImage');
  gameOverTitleEl = document.querySelector('#overlay .modal h2');
  gameOverTextEl = document.querySelector('#overlay .modal p');
  playAgainBtnEl = document.getElementById('playAgainBtn');
  toastEl = document.getElementById('toast');
  keyboardEl = document.getElementById('keyboard');
  langWorldBtn = document.getElementById('langWorld');
  menuClassicBtn = document.getElementById('menuClassic');
  menuDupletBtn = document.getElementById('menuDuplet');
  menuQuapletBtn = document.getElementById('menuQuaplet');
  menuMultiplayerBtn = document.getElementById('menuMultiplayer');
  if (menuMultiplayerBtn) {
    menuMultiplayerBtn.classList.remove('disabled');
    menuMultiplayerBtn.removeAttribute('disabled');
  }
  infoBtn = document.getElementById('infoBtn');
  infoOverlay = document.getElementById('infoOverlay');
  infoCloseBtn = document.getElementById('infoCloseBtn');
  infoTitle = document.getElementById('infoTitle');
  infoText = document.getElementById('infoText');
  githubText = document.getElementById('githubText');
}

function setButtonDisabled(button, disabled) {
  if (!button) return;
  button.disabled = disabled;
  button.classList.toggle('side-btn-disabled', disabled);
  if (disabled) {
    button.setAttribute('aria-disabled', 'true');
  } else {
    button.removeAttribute('aria-disabled');
  }
}

function anyOverlayActive() {
  const overlays = [overlay, helpOverlay, infoOverlay, langOverlay];
  return overlays.some(el => el && !el.classList.contains('hidden'));
}

function updateAppBlurState(forceBlur = false) {
  if (!appRoot) return;
  if (forceBlur || anyOverlayActive()) {
    appRoot.classList.add('blurred');
  } else {
    appRoot.classList.remove('blurred');
  }
}

function showSideOverlay(type, options = {}) {
  const { skipBlur = false } = options;
  if (type === 'lang' && langOverlay) {
    langOverlay.classList.remove('hidden');
    setButtonDisabled(infoBtn, true);
    activeSideOverlay = 'lang';
  } else if (type === 'info' && infoOverlay) {
    infoOverlay.classList.remove('hidden');
    setButtonDisabled(langWorldBtn, true);
    activeSideOverlay = 'info';
  } else {
    return;
  }
  if (!skipBlur) {
    updateAppBlurState(true);
  }
}

function hideSideOverlay(type) {
  if (type === 'lang' && langOverlay) {
    langOverlay.classList.add('hidden');
  } else if (type === 'info' && infoOverlay) {
    infoOverlay.classList.add('hidden');
  } else {
    return;
  }
  if (activeSideOverlay === type) {
    activeSideOverlay = null;
    setButtonDisabled(langWorldBtn, false);
    setButtonDisabled(infoBtn, false);
  }
  updateAppBlurState();
}

function toggleSideOverlay(type) {
  if (activeSideOverlay === type) {
    hideSideOverlay(type);
    return;
  }
  if (activeSideOverlay) {
    hideSideOverlay(activeSideOverlay);
  }
  showSideOverlay(type);
}

function getWinMessage(isLastAttempt = false) {
  return isLastAttempt ? 'Ufa! Você conseguiu!' : 'Parabéns, você conseguiu!';
}

function resizeCanvas() {
  if (confettiCanvas) {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
}
window.addEventListener('resize', resizeCanvas);

// Garantir foco no input ativo após seleções/cliques fora
document.addEventListener('selectionchange', () => {
  // Se o foco não está em um input da linha ativa, re-focar
  const active = document.activeElement;
  const inputs = getRowInputs(attempts) || [];
  if (!inputs.includes(active)) {
    ensureFocusCurrent();
  }
});

document.addEventListener('mouseup', () => {
  // Após clicar fora, recupere o foco
  setTimeout(ensureFocusCurrent, 0);
});

document.addEventListener('keydown', (e) => {
  // Se usuário começa a digitar e não há foco, recupere-o
  if (/^[a-zA-Zçãõáéíóúàèìòùâêîôû]$/.test(e.key)) {
    const active = document.activeElement;
    const inputs = getRowInputs(attempts) || [];
    if (!inputs.includes(active)) {
      ensureFocusCurrent();
    }
  }
});

function renderBoard() {
  if (!board) {
    console.error('Board element not found!');
    return;
  }
  board.innerHTML = '';
  // Toggle board mode classes for styling (single vs multi)
  if (wordCount === 1) {
    board.classList.add('single');
    board.classList.remove('multi');
  } else {
    board.classList.add('multi');
    board.classList.remove('single');
  }
  for (let r = 0; r < maxAttempts; r++) {
    if (wordCount === 1) {
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
    } else {
      const block = document.createElement('div');
      block.className = (wordCount === 4) ? 'row-block quaplet' : 'row-block duet';
      for (let wi = 0; wi < wordCount; wi++) {
        const row = document.createElement('div');
        row.className = 'row';
        row.dataset.wordIndex = String(wi);
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
        block.appendChild(row);
      }
      board.appendChild(block);
    }
  }
  focusCell(attempts, 0);
  // Add a small delay to ensure DOM is ready
  setTimeout(() => {
    addCellClickListeners(); // Adicionar event listeners de clique
  }, 10);
  renderKeyboard();
}

function setStatus(text) { 
  if (statusEl) statusEl.textContent = text; 
}

function ensureKeyStatusEntry(letter) {
  if (!keyStatuses[letter]) {
    keyStatuses[letter] = { global: null, perWord: {} };
  }
  return keyStatuses[letter];
}

function getStatusColor(status) {
  if (!status) return 'transparent';
  return keyColorPalette[status] || DEFAULT_STATUS_COLORS[status] || 'transparent';
}

async function newGame() {
  // Fade out da página inteira
  if (appRoot) {
    appRoot.style.transition = 'opacity 0.3s ease';
    appRoot.style.opacity = '0';
  }
  
  // Aguardar o fade out
  await new Promise(resolve => setTimeout(resolve, 300));
  
  try {
    const payload = { lang: currentLang };
    if (gameMode === 'duet') {
      payload.mode = 'duet';
      payload.wordCount = 2;
      payload.maxAttempts = 7;
    } else if (gameMode === 'quaplet') {
      payload.mode = 'quaplet';
      payload.wordCount = 4;
      payload.maxAttempts = 9;
    } else {
      payload.mode = 'single';
      payload.wordCount = 1;
      payload.maxAttempts = 6;
    }
    const res = await fetch('/api/new-game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { 
      setStatus('Erro ao criar novo jogo - servidor não respondeu'); 
      return; 
    }
    const data = await res.json();
    gameId = data.gameId;
    attempts = 0;
    maxAttempts = data.maxAttempts;
    wordCount = data.wordCount || 1;
    currentCol = 0;
    secretRevealed = false;
    muskiActivated = false;
    hackrActivated = false;

    // Reset solvedWords for duet mode. Each index corresponds to a word in
    // duplet/multi mode. Initially, no words are solved.
    solvedWords = new Array(wordCount).fill(false);
    solvedWordSnapshots = new Array(wordCount).fill(null);
    
    console.log('New game created:', data);
  } catch (error) {
    console.error('Error creating new game:', error);
    setStatus('Erro de conexão com servidor');
    return;
  }
  
  // Resetar título para MuskiGuess
  const titleEl = document.querySelector('h1');
  if (titleEl) {
    titleEl.textContent = 'MuskiGuess';
    titleEl.style.color = '';
    titleEl.style.textShadow = '';
    titleEl.classList.remove('reveal-effect');
  }
  
  // Resetar tema Muski
  if (muskiActivated) {
    setTheme('blue'); // Volta para o tema azul padrão
  }
  
  // Resetar fundo dourado do modo divino
  applyTheme();
  
  // Remover todos os canvases de partículas douradas
  const divineCanvas = document.getElementById('divine-particles-canvas');
  if (divineCanvas) {
    divineCanvas.remove();
  }
  // Limpar efeito HACKR (matrix rain)
  if (typeof window.__hackrInterval !== 'undefined' && window.__hackrInterval) {
    clearInterval(window.__hackrInterval);
    window.__hackrInterval = null;
  }
  const existingHackr = document.getElementById('hackr-matrix');
  if (existingHackr) {
    existingHackr.remove();
  }
  
  // Resetar bordas douradas
  if (board) board.style.border = '';
  if (keyboardEl) keyboardEl.style.border = '';
  
  if (keyboardEl) {
    // Não fazer fade do teclado separadamente - já está sendo feito com a página inteira
    keyStatuses = {};
    renderKeyboard();
  }
  renderBoard();
  // Show initial attempt status instead of a generic message
  setStatus(`Tentativa 1 de ${maxAttempts}`);
  hideOverlay();
  if (toast) toast.classList.add('hidden');
  if (confettiCanvas) confettiCanvas.classList.add('hidden');
  document.title = 'MuskiGuess';
  
  // Fade in da página inteira
  if (appRoot) {
    appRoot.style.opacity = '1';
  }
}

function getRowInputs(rowIndex) {
  // Returns the set of input elements for a given attempt row. In single
  // mode this simply returns the 5 inputs of that row. In duet/multi
  // mode we return the inputs of the first unsolved word so that focus
  // navigation highlights the appropriate active row rather than a
  // solved one. If all words are solved (which should only occur
  // immediately before game end), we return an empty array.
  if (!board || !board.children[rowIndex]) return [];
  if (wordCount === 1) {
    return Array.from(board.children[rowIndex].querySelectorAll('input'));
  }
  const block = board.children[rowIndex];
  const rows = block.querySelectorAll('.row');
  // Find the first unsolved row by checking solvedWords; if none,
  // fall back to the first row. This ensures that when the first
  // row has already been solved, keyboard navigation and focus are
  // anchored on an unsolved row.
  for (let i = 0; i < rows.length; i++) {
    if (!solvedWords[i]) {
      return Array.from(rows[i].querySelectorAll('input'));
    }
  }
  // Fallback: return empty
  return [];
}

function onInput(r, c, input) {
  input.value = input.value.toUpperCase().replace(/[^A-ZÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ]/g, '');
  
  // Mirror typing in duet/multi mode. We want to mirror the current
  // character to all other unsolved words on the same attempt. Rather
  // than always mirroring from the first row, determine the wordIndex
  // for the current input (via its parent .row dataset). Only mirror
  // to other rows that are not solved.
  if (wordCount > 1 && r === attempts) {
    // Determine which word index this input belongs to.
    let parentRowEl = input.closest('.row');
    let currentWordIndex = 0;
    if (parentRowEl && parentRowEl.dataset && parentRowEl.dataset.wordIndex) {
      currentWordIndex = parseInt(parentRowEl.dataset.wordIndex, 10) || 0;
    }
    const block = board.children[r];
    const rows = block.querySelectorAll('.row');
    rows.forEach((rowEl, idx) => {
      // Skip the row where the user is typing.
      if (idx === currentWordIndex) return;
      // Skip rows that have already been solved.
      if (solvedWords[idx]) return;
      const inputs = rowEl.querySelectorAll('input');
      if (inputs[c]) {
        inputs[c].value = input.value;
      }
    });
  }
  
  if (suppressAutoAdvance) { suppressAutoAdvance = false; return; }
  if (input.value && c < 4) {
    focusCell(r, c + 1);
  }
  // verifica segredo "BILLY" na linha ativa
  maybeRevealSecret(r);
  // micro feedback visual de digitação
  try {
    const cell = input.parentElement;
    if (cell) {
      cell.classList.remove('bump');
      // forçar reflow para reiniciar a animação
      void cell.offsetWidth;
      cell.classList.add('bump');
      setTimeout(() => cell.classList.remove('bump'), 160);
    }
  } catch {}
}

function onKeyDown(e, r, c, input) {
  if (isRevealing) { e.preventDefault(); return; }
  if (e.key === 'Backspace') {
    if (input.value) {
      input.value = '';
      // Mirror backspace in duet/multi mode. Clear the corresponding
      // character on all other unsolved rows in this attempt except
      // the current row being typed on.
      if (wordCount > 1 && r === attempts) {
        let parentRowEl = input.closest('.row');
        let currentWordIndex = 0;
        if (parentRowEl && parentRowEl.dataset && parentRowEl.dataset.wordIndex) {
          currentWordIndex = parseInt(parentRowEl.dataset.wordIndex, 10) || 0;
        }
        const block = board.children[r];
        const rows = block.querySelectorAll('.row');
        rows.forEach((rowEl, idx) => {
          if (idx === currentWordIndex) return;
          if (solvedWords[idx]) return;
          const inputs = rowEl.querySelectorAll('input');
          if (inputs[c]) {
            inputs[c].value = '';
          }
        });
      }
      // Verificar segredos após apagar
      maybeRevealSecret(r);
      return;
    }
    if (c > 0) {
      focusCell(r, c - 1);
      // Verificar segredos após mover para trás
      maybeRevealSecret(r);
    }
  } else if (e.key === 'ArrowLeft') {
    if (c > 0) focusCell(r, c - 1);
  } else if (e.key === 'ArrowRight') {
    if (c < 4) focusCell(r, c + 1);
  } else if (e.key === ' ') {
    // Espaço avança para a próxima célula
    e.preventDefault();
    if (c < 4) {
      focusCell(r, c + 1);
    }
  } else if (e.key === 'Enter') {
    // evita duplo envio via Enter rápido
    if (!isSubmitting) submitCurrentRow();
  } else if (/^[a-zA-Zçãõáéíóúàèìòùâêîôû]$/.test(e.key)) {
    // Substitui a letra atual e avança
    e.preventDefault();
    input.value = e.key.toUpperCase();
    // Mirror typing in duet/multi mode
    if (wordCount > 1 && r === attempts) {
      let parentRowEl = input.closest('.row');
      let currentWordIndex = 0;
      if (parentRowEl && parentRowEl.dataset && parentRowEl.dataset.wordIndex) {
        currentWordIndex = parseInt(parentRowEl.dataset.wordIndex, 10) || 0;
      }
      const block = board.children[r];
      const rows = block.querySelectorAll('.row');
      rows.forEach((rowEl, idx) => {
        if (idx === currentWordIndex) return;
        if (solvedWords[idx]) return;
        const inputs = rowEl.querySelectorAll('input');
        if (inputs[c]) {
          inputs[c].value = e.key.toUpperCase();
        }
      });
    }
    suppressAutoAdvance = true; // impedir que onInput avance novamente
    if (c < 4) {
      focusCell(r, c + 1);
    }
    // Verificar segredos após digitar
    maybeRevealSecret(r);
  }
}

function focusCell(r, c) {
  currentCol = c;
  const rowInputs = getRowInputs(r);
  if (rowInputs.length === 0) return;
  rowInputs.forEach((inp, idx) => {
    const cell = inp.parentElement;
    if (cell) cell.classList.toggle('active', idx === c);
  });
  if (rowInputs[c]) rowInputs[c].focus();
  // also mirror active highlight on duet/multi secondary rows of the same attempt
  if (wordCount > 1 && board && board.children[r]) {
    const block = board.children[r];
    const rows = block.querySelectorAll('.row');
    rows.forEach((rowEl, idxRow) => {
      // Skip the row that provided rowInputs; getRowInputs will anchor
      // highlighting on the first unsolved row. We only highlight other
      // unsolved rows to keep the UI synchronized across active words.
      // Determine which row is the primary row: the first unsolved row.
      let primaryIndex = 0;
      for (let i = 0; i < rows.length; i++) {
        if (!solvedWords[i]) { primaryIndex = i; break; }
      }
      if (idxRow === primaryIndex) return;
      if (solvedWords[idxRow]) return;
      const inputs = rowEl.querySelectorAll('input');
      inputs.forEach((inp, idx) => {
        const cell = inp.parentElement;
        if (cell) cell.classList.toggle('active', idx === c);
      });
    });
  }
}

// Função para adicionar event listeners de clique nas células
function addCellClickListeners() {
  const cells = document.querySelectorAll('.cell');
  cells.forEach((cell, index) => {
    // Calculate row/col for single or duet
    let row, col;
    if (wordCount === 1) {
      row = Math.floor(index / 5);
      col = index % 5;
    } else {
      // In duet, inputs are laid out in blocks; simplest is to derive from DOM
      const parentRow = cell.closest('.row');
      const parentBlock = cell.closest('.row-block');
      if (!parentRow || !parentBlock) {
        console.warn('Could not find parent row or block for cell');
        return;
      }
      row = Array.from(board.children).indexOf(parentBlock);
      col = Array.from(parentRow.children).indexOf(cell);
    }
    
    cell.addEventListener('click', () => {
      // Só permitir clique na linha ativa
      if (row === attempts) {
        // In duet/multi mode, prevent focusing on a solved word's row
        if (wordCount > 1) {
          const parentRowEl = cell.closest('.row');
          if (parentRowEl && parentRowEl.dataset && parentRowEl.dataset.wordIndex) {
            const wi = parseInt(parentRowEl.dataset.wordIndex, 10) || 0;
            if (solvedWords[wi]) {
              return; // ignore clicks on solved side
            }
          }
        }
        focusCell(row, col);
      }
    });
  });
}

function readGuessFromRow(r) {
  const inputs = getRowInputs(r);
  if (!inputs || inputs.length === 0) return '';
  return inputs.map(i => (i.value || '').toLowerCase()).join('');
}

// Função para verificar se uma palavra existe no dicionário local
async function checkWordExists(word) {
  try {
    const response = await fetch(`/api/check-word?word=${encodeURIComponent(word)}&lang=${currentLang}`);
    if (response.ok) {
      const data = await response.json();
      return data.exists;
    } else {
      console.warn('Erro ao verificar palavra:', response.status);
      return true; // Em caso de erro, assumir que a palavra é válida
    }
  } catch (error) {
    console.warn('Erro de rede ao verificar palavra:', error);
    return true; // Em caso de erro de rede, assumir que a palavra é válida
  }
}

// Função para ativar animação de tremor na tela
function shakeScreen() {
  const target = appRoot || document.body;
  target.classList.add('shake-animation');
  
  // Remove a classe após a animação terminar
  setTimeout(() => {
    target.classList.remove('shake-animation');
  }, 600); // 0.6s = duração da animação
}

function maybeRevealSecret(r) {
  if (r !== attempts) return;
  const val = readGuessFromRow(r).toUpperCase();
  
  // Verificar se é uma palavra secreta completa
  if (val === 'BILLY' && !secretRevealed) {
    revealSecretTitle();
    // Mostrar palavra atual no logo
    showCurrentWordInLogo();
    return;
  }
  if (val === 'MUSKI' && !muskiActivated) {
    revealRandomLetter();
    muskiActivated = true;
    setStatus('Uma letra foi revelada!');
    // Limpar a linha atual para não consumir tentativa
    const inputs = getRowInputs(attempts);
    inputs.forEach(input => input.value = '');
    // Clear mirrored inputs in duet mode
    if (wordCount > 1) {
      const block = board.children[attempts];
      const rows = block.querySelectorAll('.row');
      rows.forEach((rowEl, idx) => {
        if (idx === 0) return; // Skip the first row (already cleared)
        const mirroredInputs = rowEl.querySelectorAll('input');
        mirroredInputs.forEach(input => input.value = '');
      });
    }
    focusCell(attempts, 0);
    return;
  }
  if (val === 'HACKR' && !hackrActivated) {
    activateHackrMode();
    hackrActivated = true;
    // Limpar a linha atual para não consumir tentativa
    const inputs = getRowInputs(attempts);
    inputs.forEach(input => input.value = '');
    // Clear mirrored inputs in duet mode
    if (wordCount > 1) {
      const block = board.children[attempts];
      const rows = block.querySelectorAll('.row');
      rows.forEach((rowEl, idx) => {
        if (idx === 0) return; // Skip the first row (already cleared)
        const mirroredInputs = rowEl.querySelectorAll('input');
        mirroredInputs.forEach(input => input.value = '');
      });
    }
    focusCell(attempts, 0);
    return;
  }
}

// Função para revelar uma letra aleatória não descoberta que existe na palavra
async function revealRandomLetter() {
  try {
    // Fazer uma requisição para obter a palavra correta
    const res = await fetch(`/api/peek?gameId=${encodeURIComponent(gameId)}`);
    if (!res.ok) {
      setStatus('Erro ao revelar letra!');
      return;
    }
    
    const data = await res.json();
    const words = [];
    if (data.correctWord) words.push(String(data.correctWord).toUpperCase());
    if (Array.isArray(data.correctWords)) data.correctWords.forEach(w => words.push(String(w).toUpperCase()));

    // choose letters per word separately (max two for duet)
    const revealed = [];
    words.slice(0, Math.max(1, wordCount)).forEach((w, idx) => {
      const letters = [...new Set(w.split(''))];
      const pool = letters.filter(letter => {
        const entry = keyStatuses[letter];
        return !entry || !entry.global || KEY_STATUS_PRECEDENCE['yellow'] > KEY_STATUS_PRECEDENCE[entry.global];
      });
      if (pool.length > 0) {
        const picked = pool[Math.floor(Math.random() * pool.length)];
        // mark yellow (exists)
        const entry = ensureKeyStatusEntry(picked);
        if (!entry.global || KEY_STATUS_PRECEDENCE['yellow'] > KEY_STATUS_PRECEDENCE[entry.global]) {
          entry.global = 'yellow';
        }
        if (wordCount > 1) {
          if (!entry.perWord[idx] || KEY_STATUS_PRECEDENCE['yellow'] > KEY_STATUS_PRECEDENCE[entry.perWord[idx]]) {
            entry.perWord[idx] = 'yellow';
          }
        } else {
          entry.perWord[0] = 'yellow';
        }
        revealed.push({ letter: picked, index: idx });
      }
    });

    renderKeyboard();
    // Visual feedback: show which word each letter belongs to
    if (revealed.length === 0) {
      setStatus('Todas as letras já foram reveladas!');
    } else {
      const title = 'LETRA REVELADA:';
      let content = '';
      revealed.forEach((item, idx) => {
        content += `${item.index + 1} = ${item.letter}`;
        if (idx < revealed.length - 1) content += '\n';
      });
      showLetterRevealAnimation(title, content);
    }
    
  } catch (error) {
    console.error('Erro ao revelar letra:', error);
    setStatus('Erro ao revelar letra!');
  }
}

// Função para mostrar animação de revelação da letra
function showLetterRevealAnimation(title, content) {
  // Criar elemento de notificação temporário
  const notification = document.createElement('div');
  notification.className = 'letter-reveal-notification';
  
  // Split content by newlines and create formatted display
  const lines = content.split('\n');
  const formattedContent = lines.map(line => {
    const parts = line.split(' = ');
    if (parts.length === 2) {
      return `<div class="letter-reveal-line">
        <span class="letter-reveal-word">${parts[0]}</span>
        <span class="letter-reveal-equals">=</span>
        <span class="letter-reveal-letter">${parts[1]}</span>
      </div>`;
    }
    return `<div class="letter-reveal-line">${line}</div>`;
  }).join('');
  
  notification.innerHTML = `
    <div class="letter-reveal-content">
      <div class="letter-reveal-title">${title}</div>
      <div class="letter-reveal-letters">${formattedContent}</div>
    </div>
  `;
  
  // Adicionar estilos inline
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--panel);
    border: 2px solid var(--accent-color);
    border-radius: 12px;
    padding: 20px 30px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    animation: letterRevealPop 4s ease-out forwards;
    font-family: Poppins;
    color: var(--text);
    text-align: center;
    min-width: 200px;
  `;
  
  // Add styles for the content
  const style = document.createElement('style');
  style.textContent = `
    .letter-reveal-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--accent-color);
    }
    .letter-reveal-line {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 8px 0;
    }
    .letter-reveal-word {
      font-size: 18px;
      font-weight: 600;
      margin-right: 8px;
    }
    .letter-reveal-equals {
      font-size: 18px;
      margin: 0 8px;
    }
    .letter-reveal-letter {
      font-size: 24px;
      font-weight: 700;
      color: var(--accent-color);
      background: var(--accent-bg);
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid var(--accent-color);
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  // Remover após 4 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }, 4000);
}

async function revealSecretTitle() {
  try {
    if (!gameId) return;
    const res = await fetch(`/api/peek?gameId=${encodeURIComponent(gameId)}`);
    if (!res.ok) return;
    const data = await res.json();
    const displayWord = data.correctWord || (Array.isArray(data.correctWords) ? data.correctWords.join(' / ') : null);
    if (displayWord) {
      const titleEl = document.querySelector('h1');
      if (titleEl) {
        titleEl.textContent = String(displayWord).toUpperCase();
        titleEl.classList.add('reveal-effect'); // 👈 adiciona a animação
      }
      secretRevealed = true;
    }
  } catch (e) {
    console.error(e);
  }
}

async function submitCurrentRow() {
  // Debounce Enter to avoid double submission (400ms window)
  const nowTS = Date.now();
  if (typeof window.__lastSubmitAt !== 'number') {
    window.__lastSubmitAt = 0;
  }
  if (nowTS - window.__lastSubmitAt < 400) return;
  window.__lastSubmitAt = nowTS;
  if (isRevealing || isSubmitting) return;
  if (!gameId) { setStatus('Clique em Novo jogo'); return; }
  const activeInputs = getRowInputs(attempts);
  if (!activeInputs || activeInputs.length === 0) {
    return;
  }
  const guess = activeInputs.map(i => (i.value || '').toLowerCase()).join('');
  const upperGuess = guess.toUpperCase();
  
  // Não enviar palavras secretas
  if (upperGuess === 'MUSKI' || upperGuess === 'BILLY' || upperGuess === 'HACKR') { 
    return; 
  }
  
  if (!/^[a-zA-Zçãõáéíóúàèìòùâêîôû]{5}$/.test(guess)) {
    setStatus('Complete as 5 letras antes de enviar.');
    shakeScreen(); // Tremor para palavra incompleta
    return;
  }
  
  // Verificar se a palavra existe no dicionário (português e inglês)
  if (currentLang === 'pt' || currentLang === 'en') {
    setStatus('Verificando palavra...');
    const isValidWord = await checkWordExists(guess);
    if (!isValidWord) {
      setStatus('Palavra não encontrada no dicionário. Tente outra palavra.');
      shakeScreen(); // Tremor para palavra inválida
      return;
    }
  }
  
  try {
    isSubmitting = true;
    await sendGuess(guess);
  } finally {
    isSubmitting = false;
  }
}

async function sendGuess(guess) {
  const res = await fetch('/api/guess', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, guess })
  });
  const data = await res.json();
  if (!res.ok) { 
    setStatus(data.error || 'Erro ao enviar palpite'); 
    shakeScreen(); // Tremor para erro do servidor
    return; 
  }
  
  if (wordCount === 1) {
    const row = board.children[attempts];
    await revealRowWithAnimation(row, data.feedback);
    updateKeyboardFromFeedbackMulti([data.feedback]);
  } else {
    const block = board.children[attempts];
    const rowsInBlock = Array.from(block.querySelectorAll('.row'));
    const previouslySolved = solvedWords.slice();
    // Start both row reveals concurrently, skipping already-solved words
    await Promise.all(rowsInBlock.map((rowEl, wi) => {
      const fb = (data.feedback && data.feedback[wi]) || [];
      if (previouslySolved[wi]) {
        applySolvedSnapshotToRow(rowEl, wi, { populateLetters: false });
        return Promise.resolve();
      }
      return revealRowWithAnimation(rowEl, fb);
    }));
    // In duet/multi mode, determine which words are fully solved (all greens).
    if (Array.isArray(data.feedback)) {
      data.feedback.forEach((fb, wi) => {
        if (solvedWords[wi]) return;
        if (Array.isArray(fb) && fb.length === 5 && fb.every(item => item.status === 'green')) {
          solvedWords[wi] = true;
          solvedWordSnapshots[wi] = fb.map(item => ({ letter: item.letter, status: item.status }));
          applySolvedSnapshotToRow(rowsInBlock[wi], wi, { populateLetters: true });
        }
      });
    }
    const sanitizedFeedback = (data.feedback || []).map((fb, wi) => {
      if (solvedWords[wi] && Array.isArray(solvedWordSnapshots[wi])) {
        return solvedWordSnapshots[wi];
      }
      return fb || [];
    });
    updateKeyboardFromFeedbackMulti(sanitizedFeedback);
  }
  
  attempts = data.attempts;
  if (data.won) {
    const totalAllowed = typeof data.maxAttempts === 'number' ? data.maxAttempts : maxAttempts;
    const isLastAttempt = typeof totalAllowed === 'number' && totalAllowed > 0
      ? data.attempts >= totalAllowed
      : false;
    const winMessage = getWinMessage(isLastAttempt);
    setStatus(winMessage);
    showWinEffects();
    showToast(winMessage);
  } else if (data.gameOver) {
    setStatus('Fim de jogo!');
    const cw = data.correctWord || (Array.isArray(data.correctWords) ? data.correctWords.join(' / ') : '');
    showOverlay(cw);
  } else {
    enableNextRow();
    setStatus(`Tentativa ${attempts + 1} de ${maxAttempts}`);
  }
}

async function revealRowWithAnimation(row, feedback) {
  isRevealing = true;
  const perCellDelay = 300; // total time per cell flip
  // Start flip for all cells nearly together; apply statuses in mid-interval
  const cells = Array.from(row.children);
  cells.forEach(cell => cell.classList.add('revealing'));
  await new Promise(r => setTimeout(r, perCellDelay / 2));
  for (let idx = 0; idx < 5; idx++) {
    const cell = cells[idx];
    const input = cell.querySelector('input');
    const fb = feedback[idx];
    if (!fb) continue;
    input.value = fb.letter;
    input.disabled = true;
    input.tabIndex = -1;
    cell.classList.add(fb.status);
    cell.classList.remove('active');
  }
  await new Promise(r => setTimeout(r, perCellDelay / 2));
  cells.forEach(cell => cell.classList.remove('revealing'));
  isRevealing = false;
}

function applySolvedSnapshotToRow(rowEl, wordIndex, options = {}) {
  if (!rowEl) return;
  const populateLetters = options.populateLetters !== undefined ? options.populateLetters : true;
  const snapshot = Array.isArray(solvedWordSnapshots) ? solvedWordSnapshots[wordIndex] : null;
  const hasSnapshot = Array.isArray(snapshot);
  const inputs = rowEl.querySelectorAll('input');
  inputs.forEach((inp, idx) => {
    const cell = inp.parentElement;
    const snap = hasSnapshot ? snapshot[idx] : null;
    inp.disabled = true;
    inp.tabIndex = -1;
    if (populateLetters && snap && snap.letter) {
      inp.value = snap.letter;
    } else if (!populateLetters) {
      inp.value = '';
    }
    if (cell) {
      cell.classList.remove('locked-cell');
      if (populateLetters && hasSnapshot) {
        cell.classList.remove('gray', 'yellow', 'green', 'active');
        if (snap && snap.status) {
          cell.classList.add(snap.status);
        }
      } else if (!populateLetters) {
        cell.classList.remove('gray', 'yellow', 'green', 'active');
      }
      cell.classList.add('locked-cell');
    }
  });
  rowEl.classList.add('solved-locked');
}

function enableNextRow() {
  // Enable the inputs for the next attempt row. In single mode,
  // simply enable all inputs. In duet/multi mode, enable only the
  // unsolved rows and disable those that have been solved. Also clear
  // values for new attempt.
  if (wordCount > 1 && board && board.children[attempts]) {
    const block = board.children[attempts];
    const rows = block.querySelectorAll('.row');
    rows.forEach((rowEl, idxRow) => {
      const inputs = rowEl.querySelectorAll('input');
      if (solvedWords[idxRow]) {
        applySolvedSnapshotToRow(rowEl, idxRow, { populateLetters: false });
      } else {
        rowEl.classList.remove('solved-locked');
        inputs.forEach((inp, idx) => {
          const cell = inp.parentElement;
          inp.disabled = false;
          inp.tabIndex = idx + 1;
          inp.value = '';
          if (cell) {
            cell.classList.remove('gray', 'yellow', 'green', 'locked-cell', 'active');
          }
        });
      }
    });
  } else {
    const nextRowInputs = getRowInputs(attempts);
    nextRowInputs.forEach((inp, idx) => { 
      inp.disabled = false; 
      inp.tabIndex = idx + 1; 
      inp.value = ''; 
    });
  }
  focusCell(attempts, 0);
}

function showOverlay(correctWord) {
  if (correctWordEl) correctWordEl.textContent = correctWord;
  if (overlay) overlay.classList.remove('hidden');
  if (appRoot) appRoot.classList.add('blurred');
}
function hideOverlay() {
  if (overlay) overlay.classList.add('hidden');
  if (appRoot) appRoot.classList.remove('blurred');
}

function showToast(message) {
  if (toast) {
    if (typeof message === 'string' && message.trim()) {
      toast.textContent = message;
    }
    toast.classList.remove('hidden');
    setTimeout(() => { if (toast) toast.classList.add('hidden'); }, 2200);
  }
}

function showWinEffects() {
  launchConfetti();
}

function launchConfetti(color = null) {
  if (!confettiCanvas || !ctx) return;
  resizeCanvas();
  confettiCanvas.classList.remove('hidden');
  const particles = Array.from({ length: 220 }).map(() => ({
    x: Math.random() * confettiCanvas.width,
    y: -20 - Math.random() * 200,
    r: 3 + Math.random() * 4,
    color: color || `hsl(${Math.random() * 360}, 90%, 60%)`,
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

// Lang selection
function chooseLang(lang) {
  console.log('Escolhendo idioma:', lang);
  console.log('gameId atual:', gameId);
  console.log('attempts atual:', attempts);
  console.log('maxAttempts atual:', maxAttempts);
  
  currentLang = lang;
  if (langOverlay) {
    hideSideOverlay('lang');
    console.log('Overlay de idioma escondido');
  }
  applyLanguage();
  
  // Sempre iniciar novo jogo, independente de ter jogo ativo ou não
  console.log('Iniciando novo jogo com idioma:', lang);
  newGame();
}

// Função para inicializar todos os event listeners
function initEventListeners() {
  console.log('Inicializando event listeners...');
  
  // Event listeners dos botões principais
  if (newGameBtn) {
    newGameBtn.addEventListener('click', newGame);
    console.log('Botão novo jogo configurado');
  } else {
    console.log('ERRO: newGameBtn não encontrado!');
  }
  
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => { newGame(); });
    console.log('Botão jogar novamente configurado');
  } else {
    console.log('ERRO: playAgainBtn não encontrado!');
  }
  
  // Event listeners de idioma
  if (langPtBtn) {
    langPtBtn.addEventListener('click', () => chooseLang('pt'));
    console.log('Botão português configurado');
  } else {
    console.log('ERRO: langPtBtn não encontrado!');
  }
  
  if (langEnBtn) {
    langEnBtn.addEventListener('click', () => chooseLang('en'));
    console.log('Botão inglês configurado');
  } else {
    console.log('ERRO: langEnBtn não encontrado!');
  }
  
  // Event listener do tema
  if (themeToggle) {
    themeToggle.addEventListener('click', switchTheme);
    console.log('Botão tema configurado');
  } else {
    console.log('ERRO: themeToggle não encontrado!');
  }
  
  // Event listeners dos botões de tema
  const themeButtons = document.querySelectorAll('.theme-btn');
  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      setTheme(theme);
      updateThemeButtons();
    });
  });
  updateThemeButtons();
  
  // Event listeners de ajuda
  if (helpBtn) {
    helpBtn.addEventListener('click', () => { updateHelpTexts(); helpOverlay.classList.remove('hidden'); appRoot.classList.add('blurred'); });
    console.log('Botão ajuda configurado');
  } else {
    console.log('ERRO: helpBtn não encontrado!');
  }
  
  if (helpCloseBtn) {
    helpCloseBtn.addEventListener('click', () => { helpOverlay.classList.add('hidden'); appRoot.classList.remove('blurred'); });
    console.log('Botão fechar ajuda configurado');
  } else {
    console.log('ERRO: helpCloseBtn não encontrado!');
  }
  
  if (secretsBtn) {
    secretsBtn.addEventListener('click', () => { secretsContent.classList.toggle('show'); });
    console.log('Botão segredos configurado');
  } else {
    console.log('ERRO: secretsBtn não encontrado!');
  }
  
  // Event listener do botão de idioma mundial
  if (langWorldBtn) {
    langWorldBtn.addEventListener('click', () => {
      toggleSideOverlay('lang');
    });
    console.log('Botão mundo configurado');
  } else {
    console.log('ERRO: langWorldBtn não encontrado!');
  }
  
  // Event listeners do botão de informações
  if (infoBtn) {
    infoBtn.addEventListener('click', () => {
      if (activeSideOverlay === 'info') {
        hideSideOverlay('info');
        return;
      }
      updateInfoTexts();
      toggleSideOverlay('info');
    });
    console.log('Botão informações configurado');
  } else {
    console.log('ERRO: infoBtn não encontrado!');
  }
  
  if (infoCloseBtn) {
    infoCloseBtn.addEventListener('click', () => {
      hideSideOverlay('info');
    });
    console.log('Botão fechar informações configurado');
  } else {
    console.log('ERRO: infoCloseBtn não encontrado!');
  }
  
  console.log('Event listeners inicializados');
  
  // Top menu events
  if (menuClassicBtn) {
    menuClassicBtn.addEventListener('click', () => {
      setModeFromUI('single');
    });
  }
  if (menuDupletBtn) {
    menuDupletBtn.addEventListener('click', () => {
      setModeFromUI('duet');
    });
  }
  if (menuQuapletBtn) {
    menuQuapletBtn.addEventListener('click', () => {
      setModeFromUI('quaplet');
    });
  }
  if (menuMultiplayerBtn) {
    menuMultiplayerBtn.addEventListener('click', () => {
      window.location.href = '/multiplayer';
    });
  }
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM carregado, iniciando...');
  
  // Inicializar elementos DOM
  initDOMElements();
  console.log('Elementos DOM inicializados');
  
  // Inicializar event listeners
  initEventListeners();
  console.log('Event listeners inicializados');

  // Apply mode from current URL path before theme/language/new game
  applyModeFromPath(window.location.pathname, {push: false});
  // Handle browser back/forward to switch modes
  window.addEventListener('popstate', () => {
    applyModeFromPath(window.location.pathname, {push: false, startNewGame: true});
  });
  
  // Aplicar tema inicial
  applyTheme();
  console.log('Tema aplicado');
  
  // Aplicar idioma
  applyLanguage();
  console.log('Idioma aplicado');

  // Iniciar jogo imediatamente
  newGame();

  console.log('Inicialização completa');
});

// Theme toggle
let darkMode = true;
let currentTheme = 'blue'; // blue, green, red, purple

// Definir todos os temas
const themes = {
  blue: {
    dark: {
      bg: '#0f172a',
      panel: '#111827',
      text: '#e5e7eb',
      muted: '#9ca3af',
      green: '#22c55e',
      yellow: '#eab308',
      gray: '#374151',
      surface: '#0b1220',
      border: '#1f2937',
      buttonBg: 'linear-gradient(180deg, #1f2937 0%, #0f172a 100%)',
      buttonBorder: '#1f2937',
      toastBg: '#16a34a',
      toastText: '#052e16',
      worldIcon: 'static/images/worldicon2.svg',
      background: 'radial-gradient(1200px 600px at 10% 10%, #0b1225 0%, var(--bg) 60%)',
      accentColor: '#3b82f6',
      accentBg: 'rgba(59, 130, 246, 0.1)'
    },
    light: {
      bg: '#f5f7fb',
      panel: '#ffffff',
      text: '#0f172a',
      muted: '#475569',
      green: '#22c55e',
      yellow: '#eab308',
      gray: '#374151',
      surface: '#ffffff',
      border: '#e5e7eb',
      buttonBg: '#ffffff',
      buttonBorder: '#e5e7eb',
      toastBg: '#22c55e',
      toastText: '#052e16',
      worldIcon: 'static/images/worldicon.svg',
      background: 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)',
      accentColor: '#3b82f6',
      accentBg: 'rgba(59, 130, 246, 0.1)'
    }
  },
  green: {
    dark: {
      bg: '#0a1f0a',
      panel: '#0d2d0d',
      text: '#d1fae5',
      muted: '#86efac',
      green: '#10b981',
      yellow: '#f59e0b',
      gray: '#374151',
      surface: '#064e3b',
      border: '#065f46',
      buttonBg: 'linear-gradient(180deg, #065f46 0%, #0a1f0a 100%)',
      buttonBorder: '#065f46',
      toastBg: '#10b981',
      toastText: '#064e3b',
      worldIcon: 'static/images/worldicon2.svg',
      background: 'radial-gradient(1200px 600px at 10% 10%, #064e3b 0%, var(--bg) 60%)',
      accentColor: '#10b981',
      accentBg: 'rgba(16, 185, 129, 0.1)'
    },
    light: {
      bg: '#f0fdf4',
      panel: '#ffffff',
      text: '#064e3b',
      muted: '#059669',
      green: '#10b981',
      yellow: '#f59e0b',
      gray: '#374151',
      surface: '#ffffff',
      border: '#d1fae5',
      buttonBg: '#ffffff',
      buttonBorder: '#d1fae5',
      toastBg: '#10b981',
      toastText: '#064e3b',
      worldIcon: 'static/images/worldicon.svg',
      background: 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)',
      accentColor: '#10b981',
      accentBg: 'rgba(16, 185, 129, 0.1)'
    }
  },
  red: {
    dark: {
      bg: '#1f0a0a',
      panel: '#2d0d0d',
      text: '#fecaca',
      muted: '#f87171',
      green: '#ef4444',
      yellow: '#f59e0b',
      gray: '#374151',
      surface: '#3e0a0a',
      border: '#5f0a0a',
      buttonBg: 'linear-gradient(180deg, #5f0a0a 0%, #1f0a0a 100%)',
      buttonBorder: '#5f0a0a',
      toastBg: '#ef4444',
      toastText: '#3e0a0a',
      worldIcon: 'static/images/worldicon2.svg',
      background: 'radial-gradient(1200px 600px at 10% 10%, #3e0a0a 0%, var(--bg) 60%)',
      accentColor: '#ef4444',
      accentBg: 'rgba(239, 68, 68, 0.1)'
    },
    light: {
      bg: '#fef2f2',
      panel: '#ffffff',
      text: '#3e0a0a',
      muted: '#dc2626',
      green: '#ef4444',
      yellow: '#f59e0b',
      gray: '#374151',
      surface: '#ffffff',
      border: '#fecaca',
      buttonBg: '#ffffff',
      buttonBorder: '#fecaca',
      toastBg: '#ef4444',
      toastText: '#3e0a0a',
      worldIcon: 'static/images/worldicon.svg',
      background: 'linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%)',
      accentColor: '#ef4444',
      accentBg: 'rgba(239, 68, 68, 0.1)'
    }
  },
  purple: {
    dark: {
      bg: '#130820',
      panel: '#1a0b2e',
      text: '#e9d5ff',
      muted: '#c4b5fd',
      green: '#a78bfa',
      yellow: '#f0abfc',
      gray: '#3b1d5a',
      surface: '#190a2b',
      border: '#2a1743',
      buttonBg: 'linear-gradient(180deg, #2a1743 0%, #1a0b2e 100%)',
      buttonBorder: '#2a1743',
      toastBg: '#a78bfa',
      toastText: '#2e1065',
      worldIcon: 'static/images/worldicon2.svg',
      background: 'radial-gradient(1200px 600px at 10% 10%, #190a2b 0%, var(--bg) 60%)',
      accentColor: '#a78bfa',
      accentBg: 'rgba(167, 139, 250, 0.1)'
    },
    light: {
      bg: '#faf5ff',
      panel: '#ffffff',
      text: '#2e1065',
      muted: '#7c3aed',
      green: '#a78bfa',
      yellow: '#f0abfc',
      gray: '#3b1d5a',
      surface: '#ffffff',
      border: '#e9d5ff',
      buttonBg: '#ffffff',
      buttonBorder: '#e9d5ff',
      toastBg: '#a78bfa',
      toastText: '#2e1065',
      worldIcon: 'static/images/worldicon.svg',
      background: 'linear-gradient(180deg, #faf5ff 0%, #f3e8ff 100%)',
      accentColor: '#a78bfa',
      accentBg: 'rgba(167, 139, 250, 0.1)'
    }
  },
  yellow: {
    dark: {
      bg: '#1a1a0a',
      panel: '#2d2d0d',
      text: '#fef3c7',
      muted: '#fbbf24',
      green: '#f59e0b',
      yellow: '#fbbf24',
      gray: '#374151',
      surface: '#3e3e0a',
      border: '#5f5f0a',
      buttonBg: 'linear-gradient(180deg, #5f5f0a 0%, #1a1a0a 100%)',
      buttonBorder: '#5f5f0a',
      toastBg: '#f59e0b',
      toastText: '#3e3e0a',
      worldIcon: 'static/images/worldicon2.svg',
      background: 'radial-gradient(1200px 600px at 10% 10%, #3e3e0a 0%, var(--bg) 60%)',
      accentColor: '#f59e0b',
      accentBg: 'rgba(245, 158, 11, 0.1)'
    },
    light: {
      bg: '#fffbeb',
      panel: '#ffffff',
      text: '#3e3e0a',
      muted: '#d97706',
      green: '#f59e0b',
      yellow: '#fbbf24',
      gray: '#374151',
      surface: '#ffffff',
      border: '#fef3c7',
      buttonBg: '#ffffff',
      buttonBorder: '#fef3c7',
      toastBg: '#f59e0b',
      toastText: '#3e3e0a',
      worldIcon: 'static/images/worldicon.svg',
      background: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)',
      accentColor: '#f59e0b',
      accentBg: 'rgba(245, 158, 11, 0.1)'
    }
  },
  orange: {
    dark: {
      bg: '#1f0e05',
      panel: '#2c1508',
      text: '#ffedd5',
      muted: '#fb923c',
      green: '#f97316',
      yellow: '#fb923c',
      gray: '#475569',
      surface: '#3b1808',
      border: '#f97316',
      buttonBg: 'linear-gradient(180deg, #f97316 0%, #1f0e05 100%)',
      buttonBorder: '#f97316',
      toastBg: '#f97316',
      toastText: '#451a03',
      worldIcon: 'static/images/worldicon2.svg',
      background: 'radial-gradient(1200px 600px at 10% 10%, #431407 0%, var(--bg) 60%)',
      accentColor: '#fb923c',
      accentBg: 'rgba(249, 115, 22, 0.1)'
    },
    light: {
      bg: '#fff7ed',
      panel: '#ffffff',
      text: '#431407',
      muted: '#ea580c',
      green: '#f97316',
      yellow: '#fb923c',
      gray: '#475569',
      surface: '#ffffff',
      border: '#fed7aa',
      buttonBg: '#ffffff',
      buttonBorder: '#fed7aa',
      toastBg: '#f97316',
      toastText: '#431407',
      worldIcon: 'static/images/worldicon.svg',
      background: 'linear-gradient(180deg, #fff7ed 0%, #fed7aa 100%)',
      accentColor: '#f97316',
      accentBg: 'rgba(249, 115, 22, 0.15)'
    }
  },
  gold: {
    dark: {
      bg: '#1b1402',
      panel: '#2a2108',
      text: '#fef3c7',
      muted: '#fcd34d',
      green: '#facc15',
      yellow: '#fcd34d',
      gray: '#4b5563',
      surface: '#33260a',
      border: '#6b4f0b',
      buttonBg: 'linear-gradient(180deg, #6b4f0b 0%, #1b1402 100%)',
      buttonBorder: '#6b4f0b',
      toastBg: '#facc15',
      toastText: '#422006',
      worldIcon: 'static/images/worldicon2.svg',
      background: 'radial-gradient(1200px 600px at 10% 10%, #3b2a08 0%, var(--bg) 60%)',
      accentColor: '#facc15',
      accentBg: 'rgba(250, 204, 21, 0.12)'
    },
    light: {
      bg: '#fffbeb',
      panel: '#ffffff',
      text: '#422006',
      muted: '#d97706',
      green: '#facc15',
      yellow: '#fbbf24',
      gray: '#4b5563',
      surface: '#ffffff',
      border: '#fef3c7',
      buttonBg: '#ffffff',
      buttonBorder: '#fef3c7',
      toastBg: '#facc15',
      toastText: '#422006',
      worldIcon: 'static/images/worldicon.svg',
      background: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)',
      accentColor: '#facc15',
      accentBg: 'rgba(250, 204, 21, 0.15)'
    }
  },
  pink: {
    dark: {
      bg: '#1a0a0f',
      panel: '#2d0d1a',
      text: '#fce7f3',
      muted: '#f472b6',
      green: '#ec4899',
      yellow: '#f472b6',
      gray: '#3b1d2a',
      surface: '#3e0a1a',
      border: '#5f0a1a',
      buttonBg: 'linear-gradient(180deg, #5f0a1a 0%, #1a0a0f 100%)',
      buttonBorder: '#5f0a1a',
      toastBg: '#ec4899',
      toastText: '#3e0a1a',
      worldIcon: 'static/images/worldicon2.svg',
      background: 'radial-gradient(1200px 600px at 10% 10%, #3e0a1a 0%, var(--bg) 60%)',
      accentColor: '#ec4899',
      accentBg: 'rgba(236, 72, 153, 0.1)'
    },
    light: {
      bg: '#fdf2f8',
      panel: '#ffffff',
      text: '#3e0a1a',
      muted: '#be185d',
      green: '#ec4899',
      yellow: '#f472b6',
      gray: '#3b1d2a',
      surface: '#ffffff',
      border: '#fce7f3',
      buttonBg: '#ffffff',
      buttonBorder: '#fce7f3',
      toastBg: '#ec4899',
      toastText: '#3e0a1a',
      worldIcon: 'static/images/worldicon.svg',
      background: 'linear-gradient(180deg, #fdf2f8 0%, #fce7f3 100%)',
      accentColor: '#ec4899',
      accentBg: 'rgba(236, 72, 153, 0.1)'
    }
  }
};

function applyTheme() {
  const theme = themes[currentTheme][darkMode ? 'dark' : 'light'];
  
  // Aplicar transição suave
  document.body.style.transition = 'background 0.3s ease, color 0.3s ease';
  
  // Aplicar variáveis CSS
  document.documentElement.style.setProperty('--bg', theme.bg);
  document.documentElement.style.setProperty('--panel', theme.panel);
  document.documentElement.style.setProperty('--text', theme.text);
  document.documentElement.style.setProperty('--muted', theme.muted);
  document.documentElement.style.setProperty('--green', theme.green);
  document.documentElement.style.setProperty('--yellow', theme.yellow);
  document.documentElement.style.setProperty('--gray', theme.gray);
  document.documentElement.style.setProperty('--surface', theme.surface);
  document.documentElement.style.setProperty('--border', theme.border);
  document.documentElement.style.setProperty('--button-bg', theme.buttonBg);
  document.documentElement.style.setProperty('--button-border', theme.buttonBorder);
  document.documentElement.style.setProperty('--toast-bg', theme.toastBg);
  document.documentElement.style.setProperty('--toast-text', theme.toastText);
  document.documentElement.style.setProperty('--accent-color', theme.accentColor);
  document.documentElement.style.setProperty('--accent-bg', theme.accentBg);
  const trackColor = darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
  const thumbColor = theme.gray || DEFAULT_STATUS_COLORS.gray;
  const thumbHoverColor = theme.accentColor || DEFAULT_STATUS_COLORS.yellow;
  document.documentElement.style.setProperty('--scrollbar-track', trackColor);
  document.documentElement.style.setProperty('--scrollbar-thumb', thumbColor);
  document.documentElement.style.setProperty('--scrollbar-thumb-hover', thumbHoverColor);
  const accentHex = theme.accentColor || '#3b82f6';
  const accentRgb = hexToRgb(accentHex);
  const menuBg = darkMode ? 'rgba(17, 25, 40, 0.78)' : 'rgba(245, 247, 251, 0.86)';
  const menuBorder = darkMode ? 'rgba(148, 163, 184, 0.32)' : 'rgba(148, 163, 184, 0.42)';
  const menuHoverBg = `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, ${darkMode ? 0.24 : 0.16})`;
  const menuActiveBg = `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, ${darkMode ? 0.3 : 0.22})`;
  const menuShadow = darkMode ? '0 12px 28px rgba(10, 15, 28, 0.45)' : '0 12px 24px rgba(148, 163, 184, 0.25)';
  const menuHoverShadow = darkMode ? '0 6px 16px rgba(6, 11, 23, 0.32)' : '0 6px 16px rgba(148, 163, 184, 0.18)';
  const menuFocusOutline = `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, ${darkMode ? 0.55 : 0.45})`;
  document.documentElement.style.setProperty('--menu-bg', menuBg);
  document.documentElement.style.setProperty('--menu-border', menuBorder);
  document.documentElement.style.setProperty('--menu-hover-bg', menuHoverBg);
  document.documentElement.style.setProperty('--menu-active-bg', menuActiveBg);
  document.documentElement.style.setProperty('--menu-shadow', menuShadow);
  document.documentElement.style.setProperty('--menu-hover-shadow', menuHoverShadow);
  document.documentElement.style.setProperty('--menu-focus-outline', menuFocusOutline);
  keyColorPalette = {
    gray: theme.gray || DEFAULT_STATUS_COLORS.gray,
    yellow: theme.yellow || DEFAULT_STATUS_COLORS.yellow,
    green: theme.green || DEFAULT_STATUS_COLORS.green,
  };
  
  // Aplicar ícone do mundo
  const worldIcon = document.querySelector('.world-icon');
  if (worldIcon) worldIcon.src = theme.worldIcon;
  
  // Aplicar ícone do brush baseado no modo
  const brushIcon = document.querySelector('#themeBrushIcon');
  if (brushIcon) {
    brushIcon.src = darkMode ? 'static/images/brush_white.svg' : 'static/images/brush_black.svg';
  }
  
  // Aplicar fundo
  document.body.style.background = theme.background;
  
  // Atualizar ícone do botão de tema
  if (themeToggle) {
    themeToggle.textContent = darkMode ? '🌙' : '☀️';
  }
  if (keyboardEl) {
    renderKeyboard();
  }

}

function switchTheme() {
  darkMode = !darkMode;
  applyTheme();
}

function setTheme(themeName) {
  currentTheme = themeName;
  applyTheme();
}

function updateThemeButtons() {
  const themeButtons = document.querySelectorAll('.theme-btn');
  themeButtons.forEach(btn => {
    if (btn.dataset.theme === currentTheme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

applyTheme();

// Help modal
function updateHelpTexts() {
  if (helpBtn) helpBtn.textContent = 'Como jogar?';
  if (secretsBtn) secretsBtn.textContent = 'Segredos';
  if (secretsSectionTitle) secretsSectionTitle.textContent = 'Segredos Especiais';
  if (secretsSectionText) secretsSectionText.textContent = 'Digite estas palavras especiais para ativar poderes únicos:';
  if (secretMuskiTitle) secretMuskiTitle.textContent = 'MUSKI';
  if (secretMuskiText) secretMuskiText.textContent = 'Revela uma letra aleatória que ainda não foi descoberta. Não consome tentativa.';
  if (secretBillyTitle) secretBillyTitle.textContent = 'BILLY';
  if (secretBillyText) secretBillyText.textContent = 'Revela a palavra correta do jogo atual.';
  if (secretHackrTitle) secretHackrTitle.textContent = 'HACKR';
  if (secretHackrText) secretHackrText.textContent = 'Ativa a chuva de números verdes em estilo Matrix.';
  if (helpTitle) helpTitle.textContent = 'Como jogar';
  if (helpGray) helpGray.textContent = 'A letra não existe na palavra.';
  if (helpYellow) helpYellow.textContent = 'A letra existe na palavra em outra posição.';
  if (helpGreen) helpGreen.textContent = 'A letra está na posição correta.';
  if (helpTries) {
    helpTries.textContent = (
      gameMode === 'quaplet' ? 'Você tem 9 tentativas para resolver as quatro palavras.' :
      gameMode === 'duet' ? 'Você tem 7 tentativas para resolver as duas palavras.' :
      'Você tem 6 tentativas para adivinhar a palavra de 5 letras.'
    );
  }
  if (menuClassicBtn) menuClassicBtn.textContent = 'Clássico';
  if (menuDupletBtn) menuDupletBtn.textContent = 'Dupleto';
  if (menuQuapletBtn) menuQuapletBtn.textContent = 'Quapleto';
  if (menuMultiplayerBtn) menuMultiplayerBtn.textContent = 'Multiplayer';
}

function updateInfoTexts() {
  if (infoTitle) infoTitle.textContent = 'Sobre o Jogo';
  if (infoText) infoText.textContent = 'Criado por Muski360, este jogo é uma versão única inspirada no Termo e no Wordle, feito com IA.';
  if (githubText) githubText.textContent = 'Ver no GitHub';
}

function applyLanguage() {
  document.documentElement.lang = 'pt-BR';
  updateHelpTexts();
  updateInfoTexts();
  if (newGameBtnEl) newGameBtnEl.textContent = 'Novo jogo';
  if (hintEl) hintEl.textContent = '';
  if (gameOverTitleEl) gameOverTitleEl.textContent = 'Fim de jogo';
  if (gameOverTextEl && gameOverTextEl.childNodes[0]) {
    gameOverTextEl.childNodes[0].textContent = 'A palavra correta era: ';
  }
  if (playAgainBtnEl) playAgainBtnEl.textContent = 'Jogar novamente';
  if (toastEl) toastEl.textContent = 'Parabéns, você conseguiu!';
  if (board) board.setAttribute('aria-label', 'Tabuleiro do jogo');
}

// On-screen keyboard

function renderKeyboard() {
  if (!keyboardEl) return;
  keyboardEl.innerHTML = '';
  rows.forEach((letters, rIdx) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'key-row';
    letters.forEach(l => {
      const key = document.createElement('button');
      key.className = 'key';
      key.dataset.letter = l;
      if (l === 'ENTER' || l === BACKSPACE_KEY) key.classList.add('wide');
      const label = document.createElement('span');
      label.className = 'key-label';
      label.textContent = l;
      key.appendChild(label);
      if (wordCount > 1 && l !== 'ENTER' && l !== BACKSPACE_KEY) {
        const strip = document.createElement('div');
        strip.className = 'key-segment-strip';
        if (wordCount === 4) {
          strip.classList.add('mode-quaplet');
        } else if (wordCount === 2) {
          strip.classList.add('mode-duet');
        } else {
          strip.classList.add('mode-multi');
        }
        for (let i = 0; i < wordCount; i++) {
          const segment = document.createElement('span');
          segment.className = 'key-segment';
          segment.dataset.index = String(i);
          strip.appendChild(segment);
        }
        key.appendChild(strip);
      }
      applyKeyVisualState(key, l);
      key.addEventListener('click', () => onKeyPress(l));
      rowEl.appendChild(key);
    });
    keyboardEl.appendChild(rowEl);
  });
}

function applyKeyVisualState(keyEl, letter) {
  if (!keyEl) return;
  const entry = keyStatuses[letter];
  const strip = keyEl.querySelector('.key-segment-strip');
  const isQuapletStrip = !!strip && strip.classList.contains('mode-quaplet');
  keyEl.classList.remove('gray', 'yellow', 'green', 'multi-key-active');
  keyEl.style.removeProperty('--key-outline-color');
  keyEl.style.borderColor = '';
  keyEl.style.background = '';
  keyEl.style.color = '';
  if (strip) {
    strip.style.opacity = '0';
    strip.classList.remove('active');
    Array.from(strip.children).forEach(seg => {
      seg.style.background = 'var(--surface)';
      seg.style.opacity = isQuapletStrip ? '0.3' : '0.2';
    });
  }

  if (!entry || (!entry.global && (!entry.perWord || Object.keys(entry.perWord).length === 0))) {
    return;
  }

  const globalStatus = entry.global;
  if (wordCount <= 1 || letter === 'ENTER' || letter === BACKSPACE_KEY) {
    if (globalStatus) {
      keyEl.classList.add(globalStatus);
    }
    return;
  }

  if (!strip) {
    if (globalStatus) keyEl.classList.add(globalStatus);
    return;
  }

  const segments = Array.from(strip.children);
  const totalSegments = segments.length;
  let hasStatus = false;
  for (let i = 0; i < totalSegments; i++) {
    const seg = segments[i];
    const status = entry.perWord ? entry.perWord[i] : null;
    if (status && KEY_STATUS_PRECEDENCE[status]) {
      seg.style.background = getStatusColor(status);
      seg.style.opacity = '1';
      hasStatus = true;
    } else {
      seg.style.background = 'var(--surface)';
      seg.style.opacity = isQuapletStrip ? '0.3' : '0.25';
    }
  }

  if (!hasStatus && !globalStatus) {
    return;
  }

  const stripOpacity = hasStatus ? 1 : (isQuapletStrip ? 0.65 : 0.5);
  strip.style.opacity = String(stripOpacity);
  keyEl.classList.add('multi-key-active');
  keyEl.style.color = 'var(--text)';
  if (globalStatus) {
    const outlineColor = getStatusColor(globalStatus);
    if (outlineColor && outlineColor !== 'transparent') {
      keyEl.style.setProperty('--key-outline-color', outlineColor);
      keyEl.style.borderColor = outlineColor;
    }
  }
}

function onKeyPress(k) {
  if (isRevealing) return;
  if (k === 'ENTER') { 
    submitCurrentRow();
    ensureFocusCurrent();
    return; 
  }
  if (k === BACKSPACE_KEY) {
    const inputs = getRowInputs(attempts);
    const current = inputs[currentCol];
    if (current.value) { 
      current.value = '';
      // Verificar segredos após apagar
      maybeRevealSecret(attempts);
      ensureFocusCurrent();
      return; 
    }
    if (currentCol > 0) {
      focusCell(attempts, currentCol - 1);
      // Verificar segredos após mover para trás
      maybeRevealSecret(attempts);
      ensureFocusCurrent();
    }
    return;
  }
  const inputs = getRowInputs(attempts);
  const current = inputs[currentCol];
  if (!current) return;
  if (!current.value) {
    current.value = k.toUpperCase();
    if (currentCol < 4) focusCell(attempts, currentCol + 1);
    // Verificar segredos após digitar
    maybeRevealSecret(attempts);
  }
  ensureFocusCurrent();
}

function ensureFocusCurrent() {
  const inputs = getRowInputs(attempts);
  const current = inputs[currentCol];
  if (current && typeof current.focus === 'function') {
    current.focus();
  }
}

// Função para mostrar a palavra atual no logo quando BILLY é digitado
async function showCurrentWordInLogo() {
  if (!gameId) return;
  // Do NOT change the logo image per user request; only update H1 already handled in revealSecretTitle
  try {
    const response = await fetch(`/api/peek?gameId=${gameId}`);
    if (response.ok) {
      const data = await response.json();
      const wordText = data.correctWord || (Array.isArray(data.correctWords) ? data.correctWords.join(' / ') : '');
      if (wordText) {
        setStatus(`Palavra atual: ${wordText}`);
      }
    }
  } catch (error) {
    console.error('Erro ao obter palavra atual:', error);
  }
}

function updateKeyboardFromFeedback(feedback) {
  updateKeyboardFromFeedbackMulti([feedback]);
}

function updateKeyboardFromFeedbackMulti(feedbacks) {
  feedbacks.forEach((fb, wordIdx) => {
    (fb || []).forEach(item => {
      if (!item) return;
      const letter = item.letter;
      const status = item.status;
      if (!letter || !status || !KEY_STATUS_PRECEDENCE[status]) return;
      const entry = ensureKeyStatusEntry(letter);
      if (!entry.global || KEY_STATUS_PRECEDENCE[status] > KEY_STATUS_PRECEDENCE[entry.global]) {
        entry.global = status;
      }
      const idx = Number.isFinite(wordIdx) ? wordIdx : 0;
      if (idx >= wordCount) return;
      if (!entry.perWord) entry.perWord = {};
      if (!entry.perWord[idx] || KEY_STATUS_PRECEDENCE[status] > KEY_STATUS_PRECEDENCE[entry.perWord[idx]]) {
        entry.perWord[idx] = status;
      }
    });
  });
  Object.keys(keyStatuses).forEach(letter => {
    const entry = keyStatuses[letter];
    if (!entry || !entry.perWord) return;
    Object.keys(entry.perWord).forEach(idxStr => {
      const idx = parseInt(idxStr, 10);
      if (Number.isFinite(idx) && idx >= wordCount) {
        delete entry.perWord[idxStr];
      }
    });
  });
  renderKeyboard();
}

function activateDivineMode() {
  // Marca que o segredo foi ativado
  secretRevealed = true;
  
  // 1. Alterar título H1
  const titleEl = document.querySelector('h1');
  if (titleEl) {
    const titleText = '☀️ Modo Divino ☀️';
    titleEl.textContent = titleText;
    titleEl.style.color = 'gold';
    titleEl.style.textShadow = '0 0 10px rgb(3, 146, 212), 0 0 20px #fff8b0, 0 0 30px #ffe680';
  }
  
  // 2. Fundo da página com animação
  document.body.style.background = 'linear-gradient(135deg, #fff7d1, #ffd700, #ffe680, #fffde7)';
  document.body.style.transition = 'background 1s ease';
  
  // 3. Alterar status
  const statusText = '🌟 Você ascendeu!';
  setStatus(statusText);
  
  // 4. Bordas douradas no tabuleiro e teclado
  board.style.border = '2px solid gold';
  keyboardEl.style.border = '2px solid gold';
  board.style.transition = 'border 1s ease';
  keyboardEl.style.transition = 'border 1s ease';
  
  // 5. Partículas douradas
  launchDivineParticles();
  
  // 6. Confete dourado especial
  launchConfetti('#ffd700'); // aproveitando sua função de confete
}

function launchDivineParticles() {
  const canvas = document.createElement('canvas');
  canvas.id = 'divine-particles-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const particles = Array.from({ length: 150 }).map(() => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 2 + Math.random() * 3,
    vx: -1 + Math.random() * 2,
    vy: -2 + Math.random() * 0.5,
    alpha: Math.random(),
  }));
  
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.005;
      if (p.alpha <= 0) {
        p.x = Math.random() * canvas.width;
        p.y = canvas.height + 10;
        p.alpha = 1;
      }
      ctx.fillStyle = `rgba(255, 215, 0, ${p.alpha})`; // dourado
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(animate);
  }
  animate();
  
  // Remove o canvas depois de 12s
  setTimeout(() => canvas.remove(), 12000);
}

// Secret: HACKR — Matrix-style green numbers falling in the background
function activateHackrMode() {
  try {
    let canvas = document.getElementById('hackr-matrix');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'hackr-matrix';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '0';
      document.body.appendChild(canvas);
    }
    if (appRoot) {
      appRoot.style.position = 'relative';
      appRoot.style.zIndex = '1';
    }

    const ctx = canvas.getContext('2d');
    const chars = '01';
    let fontSize = 16;
    let columns = 0;
    let drops = [];

    function resizeHackr() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.max(1, Math.floor(canvas.width / fontSize));
      drops = new Array(columns).fill(0);
    }
    resizeHackr();
    window.addEventListener('resize', resizeHackr);

    function drawHackr() {
      if (!ctx) return;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00ff66';
      ctx.font = fontSize + 'px monospace';
      for (let i = 0; i < columns; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        ctx.fillText(text, x, y);
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        } else {
          drops[i]++;
        }
      }
    }

    if (window.__hackrInterval) clearInterval(window.__hackrInterval);
    window.__hackrInterval = setInterval(drawHackr, 33);
  } catch (e) {
    console.error('Failed to activate HACKR mode:', e);
  }
}
