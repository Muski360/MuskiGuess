// Teste básico para verificar se o JavaScript está funcionando
console.log('JavaScript carregado!');

let gameId = null;
let attempts = 0;
let maxAttempts = 6;
let currentCol = 0;
let secretRevealed = false;
let currentLang = 'pt';
let isRevealing = false;
let muskiActivated = false;

// Declarar variáveis do teclado ANTES das funções que as usam
const rows = [
  'QWERTYUIOP'.split(''),
  'ASDFGHJKL'.split(''),
  ['ENTER', ...'ZXCVBNM'.split(''), '⌫']
];
let keyStatuses = {}; // letter -> gray|yellow|green


// Variáveis globais para elementos DOM
let appRoot, board, statusEl, newGameBtn, overlay, correctWordEl, playAgainBtn, toast, confettiCanvas, ctx;
let winOverlay, winAttemptsEl, winPlayAgainBtn, langOverlay, langPtBtn, langEnBtn, themeToggle;
let helpBtn, helpOverlay, helpCloseBtn, helpTitle, helpGray, helpYellow, helpGreen, helpTries;
let secretsBtn, secretsContent, secretsSectionTitle, secretsSectionText, secretMuskiTitle, secretMuskiText, secretBillyTitle, secretBillyText;
let newGameBtnEl, hintEl, gameOverTitleEl, gameOverTextEl, playAgainBtnEl, toastEl;
let winTitleEl, winTextPrefixEl, winPlayAgainBtnEl, keyboardEl, langWorldBtn;
let infoBtn, infoOverlay, infoCloseBtn, infoTitle, infoText, githubText;

// Função para inicializar elementos DOM
function initDOMElements() {
  appRoot = document.getElementById('appRoot');
  board = document.getElementById('board');
  statusEl = document.getElementById('status');
  newGameBtn = document.getElementById('newGameBtn');
  overlay = document.getElementById('overlay');
  correctWordEl = document.getElementById('correctWord');
  playAgainBtn = document.getElementById('playAgainBtn');
  toast = document.getElementById('toast');
  confettiCanvas = document.getElementById('confettiCanvas');
  ctx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
  winOverlay = document.getElementById('winOverlay');
  winAttemptsEl = document.getElementById('winAttempts');
  winPlayAgainBtn = document.getElementById('winPlayAgainBtn');
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
  newGameBtnEl = document.getElementById('newGameBtn');
  hintEl = document.querySelector('.hint');
  gameOverTitleEl = document.querySelector('#overlay .modal h2');
  gameOverTextEl = document.querySelector('#overlay .modal p');
  playAgainBtnEl = document.getElementById('playAgainBtn');
  toastEl = document.getElementById('toast');
  winTitleEl = document.querySelector('#winOverlay .modal h2');
  winTextPrefixEl = document.querySelector('#winOverlay .modal p');
  winPlayAgainBtnEl = document.getElementById('winPlayAgainBtn');
  keyboardEl = document.getElementById('keyboard');
  langWorldBtn = document.getElementById('langWorld');
  infoBtn = document.getElementById('infoBtn');
  infoOverlay = document.getElementById('infoOverlay');
  infoCloseBtn = document.getElementById('infoCloseBtn');
  infoTitle = document.getElementById('infoTitle');
  infoText = document.getElementById('infoText');
  githubText = document.getElementById('githubText');
}

function resizeCanvas() {
  if (confettiCanvas) {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
}
window.addEventListener('resize', resizeCanvas);

function renderBoard() {
  if (!board) return;
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
  addCellClickListeners(); // Adicionar event listeners de clique
  renderKeyboard();
}

function setStatus(text) { 
  if (statusEl) statusEl.textContent = text; 
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
    const res = await fetch('/api/new-game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: currentLang }) });
    if (!res.ok) { 
      setStatus('Erro ao criar novo jogo - servidor não respondeu'); 
      return; 
    }
    const data = await res.json();
    gameId = data.gameId;
    attempts = 0;
    maxAttempts = data.maxAttempts;
    currentCol = 0;
    secretRevealed = false;
    muskiActivated = false;
    
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
  
  // Resetar bordas douradas
  if (board) board.style.border = '';
  if (keyboardEl) keyboardEl.style.border = '';
  
  if (keyboardEl) {
    // Não fazer fade do teclado separadamente - já está sendo feito com a página inteira
    keyStatuses = {};
    renderKeyboard();
  }
  renderBoard();
  setStatus(currentLang === 'en' ? 'New game started!' : 'Novo jogo iniciado!');
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
  if (!board || !board.children[rowIndex]) return [];
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
  if (isRevealing) { e.preventDefault(); return; }
  if (e.key === 'Backspace') {
    if (input.value) {
      input.value = '';
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
  } else if (e.key === 'Enter') {
    submitCurrentRow();
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
}

// Função para adicionar event listeners de clique nas células
function addCellClickListeners() {
  const cells = document.querySelectorAll('.cell');
  cells.forEach((cell, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    
    cell.addEventListener('click', () => {
      // Só permitir clique na linha ativa
      if (row === attempts) {
        focusCell(row, col);
      }
    });
  });
}

function readGuessFromRow(r) {
  return getRowInputs(r).map(i => (i.value || '').toLowerCase()).join('');
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

function maybeRevealSecret(r) {
  if (r !== attempts) return;
  const val = readGuessFromRow(r).toUpperCase();
  
  // Verificar se é uma palavra secreta completa
  if (val === 'BILLY' && !secretRevealed) {
    revealSecretTitle();
    return;
  }
  if (val === 'MUSKI' && !muskiActivated) {
    revealRandomLetter();
    muskiActivated = true;
    setStatus(currentLang === 'en' ? 'A letter has been revealed!' : 'Uma letra foi revelada!');
    // Limpar a linha atual para não consumir tentativa
    const inputs = getRowInputs(attempts);
    inputs.forEach(input => input.value = '');
    focusCell(attempts, 0);
    return;
  }
  if (val === 'RIANN' && !secretRevealed) {
    activateDivineMode();
    // Limpar a linha atual para não consumir tentativa
    const inputs = getRowInputs(attempts);
    inputs.forEach(input => input.value = '');
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
      setStatus(currentLang === 'en' ? 'Error revealing letter!' : 'Erro ao revelar letra!');
      return;
    }
    
    const data = await res.json();
    const correctWord = data.correctWord.toUpperCase();
    
    // Obter letras únicas da palavra correta
    const wordLetters = [...new Set(correctWord.split(''))];
    
    // Filtrar letras que ainda não foram descobertas E que existem na palavra
    const undiscoveredWordLetters = wordLetters.filter(letter => !keyStatuses[letter]);
    
    if (undiscoveredWordLetters.length === 0) {
      setStatus(currentLang === 'en' ? 'All word letters already discovered!' : 'Todas as letras da palavra já foram descobertas!');
      return;
    }
    
    // Escolher uma letra aleatória da palavra
    const randomLetter = undiscoveredWordLetters[Math.floor(Math.random() * undiscoveredWordLetters.length)];
    
    // Marcar a letra como revelada (amarela para indicar que existe na palavra)
    keyStatuses[randomLetter] = 'yellow';
    
    // Atualizar o teclado visual
    renderKeyboard();
    
    // Mostrar feedback visual
    showLetterRevealAnimation(randomLetter);
    
  } catch (error) {
    console.error('Erro ao revelar letra:', error);
    setStatus(currentLang === 'en' ? 'Error revealing letter!' : 'Erro ao revelar letra!');
  }
}

// Função para mostrar animação de revelação da letra
function showLetterRevealAnimation(letter) {
  // Criar elemento de notificação temporário
  const notification = document.createElement('div');
  notification.className = 'letter-reveal-notification';
  notification.innerHTML = `
    <div class="letter-reveal-content">
      <span class="letter-reveal-icon">✨</span>
      <span class="letter-reveal-text">
        ${currentLang === 'en' ? 'Letter revealed:' : 'Letra revelada:'} 
        <strong>${letter}</strong>
      </span>
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
    padding: 16px 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    animation: letterRevealPop 2s ease-out forwards;
    font-family: Poppins;
    color: var(--text);
  `;
  
  document.body.appendChild(notification);
  
  // Remover após 2 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 2000);
}

async function revealSecretTitle() {
  try {
    if (!gameId) return;
    const res = await fetch(`/api/peek?gameId=${encodeURIComponent(gameId)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.correctWord) {
      const titleEl = document.querySelector('h1');
      if (titleEl) {
        titleEl.textContent = data.correctWord.toUpperCase();
        titleEl.classList.add('reveal-effect'); // 👈 adiciona a animação
      }
      secretRevealed = true;
    }
  } catch (e) {
    console.error(e);
  }
}

async function submitCurrentRow() {
  if (isRevealing) return;
  if (!gameId) { setStatus('Clique em Novo jogo'); return; }
  const guess = readGuessFromRow(attempts);
  const upperGuess = guess.toUpperCase();
  
  // Não enviar palavras secretas
  if (upperGuess === 'MUSKI' || upperGuess === 'BILLY' || upperGuess === 'RIANN') { 
    return; 
  }
  
  if (!/^[a-zA-Zçãõáéíóúàèìòùâêîôû]{5}$/.test(guess)) {
    setStatus(currentLang === 'en' ? 'Fill all 5 letters before sending.' : 'Complete as 5 letras antes de enviar.');
    return;
  }
  
  // Verificar se a palavra existe no dicionário (português e inglês)
  if (currentLang === 'pt' || currentLang === 'en') {
    setStatus(currentLang === 'en' ? 'Checking word...' : 'Verificando palavra...');
    const isValidWord = await checkWordExists(guess);
    if (!isValidWord) {
      setStatus(currentLang === 'en' ? 'Word not found in dictionary. Try another word.' : 'Palavra não encontrada no dicionário. Tente outra palavra.');
      return;
    }
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
    setStatus(currentLang === 'en' ? 'Congratulations!' : 'Parabéns!');
    showWinEffects();
    showWinOverlay(data.attempts);
  } else if (data.gameOver) {
    setStatus(currentLang === 'en' ? 'Game over!' : 'Fim de jogo!');
    showOverlay(data.correctWord || '');
  } else {
    enableNextRow();
    setStatus(currentLang === 'en' ? `Attempt ${attempts + 1} of ${maxAttempts}` : `Tentativa ${attempts + 1} de ${maxAttempts}`);
  }
}

async function revealRowWithAnimation(row, feedback) {
  isRevealing = true;
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
  updateKeyboardFromFeedback(feedback);
  isRevealing = false;
}

function enableNextRow() {
  const nextRowInputs = getRowInputs(attempts);
  nextRowInputs.forEach((inp, idx) => { 
    inp.disabled = false; 
    inp.tabIndex = idx + 1; 
    inp.value = ''; 
  });
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

function showWinOverlay(attemptCount) {
  if (winAttemptsEl) winAttemptsEl.textContent = attemptCount;
  if (winOverlay) winOverlay.classList.remove('hidden');
  if (appRoot) appRoot.classList.add('blurred');
}
function hideWinOverlay() {
  if (winOverlay) winOverlay.classList.add('hidden');
  if (appRoot) appRoot.classList.remove('blurred');
}

function showToast() {
  if (toast) {
    toast.classList.remove('hidden');
    setTimeout(() => { if (toast) toast.classList.add('hidden'); }, 1800);
  }
}

function showWinEffects() {
  showToast();
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
    langOverlay.classList.add('hidden');
    appRoot.classList.remove('blurred');
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
  
  if (winPlayAgainBtn) {
    winPlayAgainBtn.addEventListener('click', () => { hideWinOverlay(); newGame(); });
    console.log('Botão jogar novamente (vitória) configurado');
  } else {
    console.log('ERRO: winPlayAgainBtn não encontrado!');
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
      // Sempre mostrar overlay de idioma
      if (langOverlay) {
        langOverlay.classList.remove('hidden');
        appRoot.classList.add('blurred');
      }
    });
    console.log('Botão mundo configurado');
  } else {
    console.log('ERRO: langWorldBtn não encontrado!');
  }
  
  // Event listeners do botão de informações
  if (infoBtn) {
    infoBtn.addEventListener('click', () => { 
      updateInfoTexts();
      if (infoOverlay) {
        infoOverlay.classList.remove('hidden');
        appRoot.classList.add('blurred');
      }
    });
    console.log('Botão informações configurado');
  } else {
    console.log('ERRO: infoBtn não encontrado!');
  }
  
  if (infoCloseBtn) {
    infoCloseBtn.addEventListener('click', () => { 
      if (infoOverlay) {
        infoOverlay.classList.add('hidden');
        appRoot.classList.remove('blurred');
      }
    });
    console.log('Botão fechar informações configurado');
  } else {
    console.log('ERRO: infoCloseBtn não encontrado!');
  }
  
  console.log('Event listeners inicializados');
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM carregado, iniciando...');
  
  // Inicializar elementos DOM
  initDOMElements();
  console.log('Elementos DOM inicializados');
  
  // Verificar se há tema salvo no localStorage
  const savedTheme = localStorage.getItem('muskiGuess_theme');
  const savedDarkMode = localStorage.getItem('muskiGuess_darkMode');
  const savedLang = localStorage.getItem('muskiGuess_lang');
  
  console.log('Dados salvos encontrados:', {savedTheme, savedDarkMode, savedLang});
  
  if (savedTheme && savedDarkMode && savedLang) {
    console.log('Restaurando tema salvo:', savedTheme, savedDarkMode, savedLang);
    currentTheme = savedTheme;
    darkMode = savedDarkMode === 'true';
    currentLang = savedLang;
    
    // Limpar dados salvos IMEDIATAMENTE após restaurar
    localStorage.removeItem('muskiGuess_theme');
    localStorage.removeItem('muskiGuess_darkMode');
    localStorage.removeItem('muskiGuess_lang');
    console.log('Dados salvos limpos do localStorage');
  }
  
  // Inicializar event listeners
  initEventListeners();
  console.log('Event listeners inicializados');
  
  // Aplicar tema inicial
  applyTheme();
  console.log('Tema aplicado');
  
  // Aplicar idioma
  applyLanguage();
  console.log('Idioma aplicado');
  
  // Se há idioma salvo, iniciar jogo diretamente
  if (savedLang) {
    console.log('Idioma restaurado, iniciando novo jogo...');
    newGame();
  } else {
    // Mostrar overlay de idioma apenas se não há idioma salvo
    if (langOverlay) {
      langOverlay.classList.remove('hidden');
      console.log('Overlay de idioma mostrado');
    } else {
      console.log('ERRO: langOverlay não encontrado!');
    }
  }
  
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
      bg: '#1a0f0a',
      panel: '#2d1a0d',
      text: '#fed7aa',
      muted: '#fb923c',
      green: '#ea580c',
      yellow: '#fb923c',
      gray: '#374151',
      surface: '#3e1a0a',
      border: '#5f1a0a',
      buttonBg: 'linear-gradient(180deg, #5f1a0a 0%, #1a0f0a 100%)',
      buttonBorder: '#5f1a0a',
      toastBg: '#ea580c',
      toastText: '#3e1a0a',
      worldIcon: 'static/images/worldicon2.svg',
      background: 'radial-gradient(1200px 600px at 10% 10%, #3e1a0a 0%, var(--bg) 60%)',
      accentColor: '#ea580c',
      accentBg: 'rgba(234, 88, 12, 0.1)'
    },
    light: {
      bg: '#fff7ed',
      panel: '#ffffff',
      text: '#3e1a0a',
      muted: '#c2410c',
      green: '#ea580c',
      yellow: '#fb923c',
      gray: '#374151',
      surface: '#ffffff',
      border: '#fed7aa',
      buttonBg: '#ffffff',
      buttonBorder: '#fed7aa',
      toastBg: '#ea580c',
      toastText: '#3e1a0a',
      worldIcon: 'static/images/worldicon.svg',
      background: 'linear-gradient(180deg, #fff7ed 0%, #fed7aa 100%)',
      accentColor: '#ea580c',
      accentBg: 'rgba(234, 88, 12, 0.1)'
    }
  },
  brown: {
    dark: {
      bg: '#1a0f0a',
      panel: '#2d1a0d',
      text: '#d2b48c',
      muted: '#a0522d',
      green: '#8b4513',
      yellow: '#a0522d',
      gray: '#374151',
      surface: '#3e1a0a',
      border: '#5f1a0a',
      buttonBg: 'linear-gradient(180deg, #5f1a0a 0%, #1a0f0a 100%)',
      buttonBorder: '#5f1a0a',
      toastBg: '#8b4513',
      toastText: '#3e1a0a',
      worldIcon: 'static/images/worldicon2.svg',
      background: 'radial-gradient(1200px 600px at 10% 10%, #3e1a0a 0%, var(--bg) 60%)',
      accentColor: '#8b4513',
      accentBg: 'rgba(139, 69, 19, 0.1)'
    },
    light: {
      bg: '#fef7ed',
      panel: '#ffffff',
      text: '#3e1a0a',
      muted: '#8b4513',
      green: '#8b4513',
      yellow: '#a0522d',
      gray: '#374151',
      surface: '#ffffff',
      border: '#d2b48c',
      buttonBg: '#ffffff',
      buttonBorder: '#d2b48c',
      toastBg: '#8b4513',
      toastText: '#3e1a0a',
      worldIcon: 'static/images/worldicon.svg',
      background: 'linear-gradient(180deg, #fef7ed 0%, #d2b48c 100%)',
      accentColor: '#8b4513',
      accentBg: 'rgba(139, 69, 19, 0.1)'
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
  if (currentLang === 'en') {
    helpBtn.textContent = 'How to play?';
    secretsBtn.textContent = 'Secrets';
    secretsSectionTitle.textContent = 'Special Secrets';
    secretsSectionText.textContent = 'Type these special words to activate unique powers:';
    secretMuskiTitle.textContent = 'MUSKI';
    secretMuskiText.textContent = 'Reveals a random letter that has not been discovered yet. Does not consume a try.';
    secretBillyTitle.textContent = 'BILLY';
    secretBillyText.textContent = 'Reveals the current game word.';
    helpTitle.textContent = 'How to play';
    helpGray.textContent = 'The letter is not in the word.';
    helpYellow.textContent = 'The letter is in the word but wrong position.';
    helpGreen.textContent = 'The letter is in the correct position.';
    helpTries.textContent = 'You have 6 tries to guess the 5-letter word.';
  } else {
    helpBtn.textContent = 'Como jogar?';
    secretsBtn.textContent = 'Segredos';
    secretsSectionTitle.textContent = 'Segredos Especiais';
    secretsSectionText.textContent = 'Digite estas palavras especiais para ativar poderes únicos:';
    secretMuskiTitle.textContent = 'MUSKI';
    secretMuskiText.textContent = 'Revela uma letra aleatória que ainda não foi descoberta. Não consome tentativa.';
    secretBillyTitle.textContent = 'BILLY';
    secretBillyText.textContent = 'Revela a palavra correta do jogo atual.';
    helpTitle.textContent = 'Como jogar';
    helpGray.textContent = 'A letra não existe na palavra.';
    helpYellow.textContent = 'A letra existe na palavra em outra posição.';
    helpGreen.textContent = 'A letra está na posição correta.';
    helpTries.textContent = 'Você tem 6 tentativas para adivinhar a palavra de 5 letras.';
  }
}

// Info modal
function updateInfoTexts() {
  if (currentLang === 'en') {
    if (infoTitle) infoTitle.textContent = 'About the Game';
    if (infoText) infoText.textContent = 'Made by Muski360, this game was inspired by Termo and Wordle. Made with AI.';
    if (githubText) githubText.textContent = 'View on GitHub';
  } else {
    if (infoTitle) infoTitle.textContent = 'Sobre o Jogo';
    if (infoText) infoText.textContent = 'Feito por Muski360, esse jogo foi inspirado no Termo e no Wordle. Feito por IA.';
    if (githubText) githubText.textContent = 'Ver no GitHub';
  }
}
function applyLanguage() {
  document.documentElement.lang = currentLang === 'en' ? 'en' : 'pt-BR';
  updateHelpTexts();
  updateInfoTexts();
  if (currentLang === 'en') {
    if (newGameBtnEl) newGameBtnEl.textContent = 'New game';
    if (hintEl) hintEl.textContent = 'Type directly in the squares. Good luck!';
    if (gameOverTitleEl) gameOverTitleEl.textContent = 'Game over';
    if (gameOverTextEl && gameOverTextEl.childNodes[0]) gameOverTextEl.childNodes[0].textContent = 'The correct word was: ';
    if (playAgainBtnEl) playAgainBtnEl.textContent = 'Play again';
    if (toastEl) toastEl.textContent = 'Congrats! You got it!';
    if (winTitleEl) winTitleEl.textContent = 'You won!';
    // winTextPrefixEl has: 'Acertou em ' + <span id="winAttempts"></span> + ' tentativas.'
    if (winTextPrefixEl && winTextPrefixEl.childNodes[0]) winTextPrefixEl.childNodes[0].textContent = 'Solved in ';
    // after span stays; we replace trailing text node after span
    if (winTextPrefixEl && winTextPrefixEl.childNodes.length > 2) {
      winTextPrefixEl.childNodes[2].textContent = ' tries.';
    }
    if (winPlayAgainBtnEl) winPlayAgainBtnEl.textContent = 'Play again';
    if (board) board.setAttribute('aria-label', 'Game board');
  } else {
    if (newGameBtnEl) newGameBtnEl.textContent = 'Novo jogo';
    if (hintEl) hintEl.textContent = 'Digite diretamente nos quadrados. Boa sorte!';
    if (gameOverTitleEl) gameOverTitleEl.textContent = 'Fim de jogo';
    if (gameOverTextEl && gameOverTextEl.childNodes[0]) gameOverTextEl.childNodes[0].textContent = 'A palavra correta era: ';
    if (playAgainBtnEl) playAgainBtnEl.textContent = 'Jogar novamente';
    if (toastEl) toastEl.textContent = 'Parabéns! Você acertou!';
    if (winTitleEl) winTitleEl.textContent = 'Você acertou!';
    if (winTextPrefixEl && winTextPrefixEl.childNodes.length > 0) {
      winTextPrefixEl.childNodes[0].textContent = 'Acertou em ';
    }
    if (winTextPrefixEl && winTextPrefixEl.childNodes.length > 2) {
      winTextPrefixEl.childNodes[2].textContent = ' tentativas.';
    }
    if (board) board.setAttribute('aria-label', 'Tabuleiro do jogo');
  }
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
      key.textContent = l;
      if (l === 'ENTER' || l === '⌫') key.classList.add('wide');
      const status = keyStatuses[l];
      if (status) key.classList.add(status);
      key.addEventListener('click', () => onKeyPress(l));
      rowEl.appendChild(key);
    });
    keyboardEl.appendChild(rowEl);
  });
}

function onKeyPress(k) {
  if (isRevealing) return;
  if (k === 'ENTER') { submitCurrentRow(); return; }
  if (k === '⌫') {
    const inputs = getRowInputs(attempts);
    const current = inputs[currentCol];
    if (current.value) { 
      current.value = '';
      // Verificar segredos após apagar
      maybeRevealSecret(attempts);
      return; 
    }
    if (currentCol > 0) {
      focusCell(attempts, currentCol - 1);
      // Verificar segredos após mover para trás
      maybeRevealSecret(attempts);
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
}

function updateKeyboardFromFeedback(feedback) {
  // precedence: green > yellow > gray
  feedback.forEach(item => {
    const l = item.letter;
    const s = item.status;
    const prev = keyStatuses[l];
    if (prev === 'green') return;
    if (s === 'green' || (s === 'yellow' && prev !== 'green')) keyStatuses[l] = s;
    if (!prev) keyStatuses[l] = s;
  });
  renderKeyboard();
}


function activateDivineMode() {
  // Marca que o segredo foi ativado
  secretRevealed = true;

  // 1. Alterar título H1
  const titleEl = document.querySelector('h1');
  if (titleEl) {
    const titleText = currentLang === 'en' ? '☀️ Divine Mode ☀️' : '☀️ Modo Divino ☀️';
    titleEl.textContent = titleText;
    titleEl.style.color = 'gold';
    titleEl.style.textShadow = '0 0 10px rgb(3, 146, 212), 0 0 20px #fff8b0, 0 0 30px #ffe680';
  }

  // 2. Fundo da página com animação
  document.body.style.background = 'linear-gradient(135deg, #fff7d1, #ffd700, #ffe680, #fffde7)';
  document.body.style.transition = 'background 1s ease';

  // 3. Alterar status
  const statusText = currentLang === 'en' ? '🌟 You have ascended, RIANN!' : '🌟 Você ascendeu, RIANN!';
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




