(function () {
  const socketLibraryLoaded = typeof window !== 'undefined' && typeof window.io === 'function';
  const socket = socketLibraryLoaded ? window.io() : {
    connected: false,
    emit: (...args) => console.warn('Socket.IO client not available. Event skipped.', args),
    on: () => {},
    off: () => {},
    connect: () => {},
  };
  let socketConnectionEstablished = false;
  if (socketLibraryLoaded) {
    socket.on('connect', () => {
      socketConnectionEstablished = true;
    });
    socket.on('disconnect', () => {
      socketConnectionEstablished = false;
    });
    socket.on('connect_error', () => {
      socketConnectionEstablished = false;
    });
  } else {
    console.error('Socket.IO client script failed to load. Multiplayer features are disabled.');
  }

  const state = {
    playerId: null,
    roomCode: null,
    isHost: false,
    roomStatus: 'idle',
    attemptLimit: 6,
    roundNumber: 0,
    roundActive: false,
    tiebreakerActive: false,
    localAttempts: 0,
    language: 'pt',
    roundsTarget: 3,
    players: [],
  };

  const boards = new Map();
  let toastTimeout = null;

  const entryView = document.getElementById('entryView');
  const gameView = document.getElementById('gameView');
  const scoreboardList = document.getElementById('scoreboardList');
  const boardsContainer = document.getElementById('boardsContainer');
  const roundInfoEl = document.getElementById('roundInfo');
  const statusMessageEl = document.getElementById('statusMessage');
  const attemptsInfoEl = document.getElementById('attemptsInfo');
  const lobbyStatusEl = document.getElementById('lobbyStatusText');
  const hostPanel = document.getElementById('hostPanel');

  const displayNameInput = document.getElementById('displayNameInput');
  const roomCodeInput = document.getElementById('roomCodeInput');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const joinRoomBtn = document.getElementById('joinRoomBtn');

  const leaveRoomBtn = document.getElementById('leaveRoomBtn');
  const roomCodeWrap = document.getElementById('roomCodeWrap');
  const roomCodeText = document.getElementById('roomCodeText');
  const copyCodeBtn = document.getElementById('copyCodeBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  const roundRadioGroup = document.getElementById('roundRadioGroup');
  const languageSelect = document.getElementById('languageSelect');
  const startMatchBtn = document.getElementById('startMatchBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');

  const guessForm = document.getElementById('guessForm');
  const letterGrid = document.getElementById('guessLetterGrid');
  const letterInputs = Array.from(document.querySelectorAll('.mp-letter-input'));
  let activeLetterIndex = 0;

  const toastEl = document.getElementById('toast');
  const modalOverlay = document.getElementById('resultOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const countdownOverlay = document.getElementById('countdownOverlay');
  const countdownNumberEl = document.getElementById('countdownNumber');
  const roundResultOverlay = document.getElementById('roundResultOverlay');
  const roundResultMessageEl = document.getElementById('roundResultMessage');
  const roundResultWordEl = document.getElementById('roundResultWord');
  const modeMenu = document.querySelector('.mp-mode-menu');
  let roundResultTimeoutId = null;
  let countdownRunning = false;
  let countdownTimeoutIds = [];
  let countdownResolve = null;

  const MAX_ATTEMPTS_FALLBACK = 6;

  function sanitizeName(name) {
    return (name || '').replace(/\s+/g, ' ').trim().slice(0, 16);
  }

  function sanitizeCode(code) {
    return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  function showToast(message, options = {}) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, options.duration || 2800);
  }

  const THEME_STORAGE_KEY = 'multiplayerTheme';
  let currentTheme = 'dark';
  const SUN_ICON = '\u2600';
  const MOON_ICON = '\u{1F319}';

  function applyTheme(theme) {
    currentTheme = theme === 'light' ? 'light' : 'dark';
    document.body.classList.toggle('mp-theme-light', currentTheme === 'light');
    if (themeToggleBtn) {
      themeToggleBtn.textContent = currentTheme === 'light' ? MOON_ICON : SUN_ICON;
      themeToggleBtn.setAttribute(
        'aria-label',
        currentTheme === 'light' ? 'Alternar para tema escuro' : 'Alternar para tema claro'
      );
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    } catch (_) {
      /* ignore storage errors */
    }
  }

  function openModal(title, message) {
    if (!modalOverlay) return;
    modalTitle.textContent = title;
    modalMessage.innerHTML = message;
    modalOverlay.classList.remove('hidden');
  }

  function closeModal() {
    if (modalOverlay) {
      modalOverlay.classList.add('hidden');
    }
  }

  function setRoomCode(code) {
    if (!roomCodeWrap || !roomCodeText) return;
    if (code) {
      roomCodeText.textContent = code;
      roomCodeWrap.classList.remove('hidden');
      leaveRoomBtn?.classList.remove('hidden');
    } else {
      roomCodeText.textContent = '----';
      roomCodeWrap.classList.add('hidden');
      leaveRoomBtn?.classList.add('hidden');
    }
  }

  function updateLobbyStatus() {
    if (!lobbyStatusEl) return;
    const map = {
      idle: 'Aguardando',
      lobby: 'Aguardando',
      playing: 'Em andamento',
      finished: 'Encerrada',
    };
    lobbyStatusEl.textContent = map[state.roomStatus] || 'Aguardando';
  }

  function toggleViews(inRoom) {
    if (inRoom) {
      entryView?.classList.add('hidden');
      gameView?.classList.remove('hidden');
    } else {
      entryView?.classList.remove('hidden');
      gameView?.classList.add('hidden');
    }
    if (modeMenu) {
      modeMenu.classList.toggle('hidden', Boolean(inRoom));
    }
  }

  function clampLetterIndex(index) {
    if (!letterInputs.length) return 0;
    if (index < 0) return 0;
    if (index >= letterInputs.length) return letterInputs.length - 1;
    return index;
  }

  function setActiveLetter(index, options = {}) {
    if (!letterInputs.length) return;
    const targetIndex = clampLetterIndex(index);
    activeLetterIndex = targetIndex;
    const target = letterInputs[targetIndex];
    if (!target || target.disabled) return;
    const shouldSelect = options.select !== false;
    if (document.activeElement !== target) {
      target.focus({ preventScroll: true });
    }
    if (shouldSelect) {
      target.select();
    }
  }

  function moveActiveLetter(delta) {
    const nextIndex = clampLetterIndex(activeLetterIndex + delta);
    setActiveLetter(nextIndex);
  }

  function clearGuessInputs({ focus = true } = {}) {
    letterInputs.forEach(input => {
      input.value = '';
    });
    activeLetterIndex = 0;
    if (focus) {
      setTimeout(() => setActiveLetter(0), 0);
    }
    updateActiveGuessPreview();
  }

  function setGuessInputsEnabled(enabled, { focus = true } = {}) {
    letterInputs.forEach(input => {
      input.disabled = !enabled;
      if (!enabled) {
        input.blur();
      }
    });
    if (enabled && focus) {
      setTimeout(() => setActiveLetter(activeLetterIndex || 0), 0);
    }
  }

  function getCurrentGuessValue() {
    if (!letterInputs.length) return '';
    return letterInputs.map(input => (input.value || '').toUpperCase()).join('');
  }

  function updateActiveGuessPreview() {
    const board = boards.get(state.playerId);
    if (!board || !state.roundActive || !letterInputs.length) return;
    const rowIndex = Math.min(board.attemptIndex, board.rows.length - 1);
    if (rowIndex < 0) return;
    const row = board.rows[rowIndex];
    if (!row) return;
    letterInputs.forEach((input, idx) => {
      const cell = row[idx];
      if (!cell) return;
      cell.classList.remove('status-green', 'status-yellow', 'status-gray', 'revealed');
      cell.textContent = (input.value || '').toUpperCase();
    });
  }

  function handleLetterInputEvent(event, index) {
    const input = event.target;
    if (!input) return;
    const raw = (input.value || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!raw) {
      input.value = '';
      updateActiveGuessPreview();
      return;
    }
    const letter = raw.slice(-1);
    input.value = letter;
    const isLast = index >= letterInputs.length - 1;
    if (!isLast) {
      moveActiveLetter(1);
    } else {
      input.select();
    }
    updateActiveGuessPreview();
  }

  function handleLetterKeyDownEvent(event, index) {
    const key = event.key;
    if (!key) return;
    if (key === 'ArrowLeft' || key === 'ArrowUp') {
      event.preventDefault();
      moveActiveLetter(-1);
      return;
    }
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      event.preventDefault();
      moveActiveLetter(1);
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      const input = letterInputs[index];
      if (input && input.value) {
        input.value = '';
        input.select();
      } else if (index > 0) {
        moveActiveLetter(-1);
        const prev = letterInputs[clampLetterIndex(index - 1)];
        if (prev) {
          prev.value = '';
          prev.select();
        }
      }
      updateActiveGuessPreview();
      return;
    }
    if (key === 'Delete') {
      event.preventDefault();
      const input = letterInputs[index];
      if (input) {
        input.value = '';
      }
      updateActiveGuessPreview();
      return;
    }
    if (key === ' ') {
      event.preventDefault();
      moveActiveLetter(1);
      updateActiveGuessPreview();
      return;
    }
    if (key.length === 1 && !/[a-zA-Z]/.test(key)) {
      event.preventDefault();
      return;
    }
  }

  function handleLetterPaste(event, index) {
    event.preventDefault();
    const clipboard = event.clipboardData || window.clipboardData;
    const text = clipboard ? clipboard.getData('text') : '';
    if (!text) return;
    const sanitized = text.toUpperCase().replace(/[^A-Z]/g, '');
    if (!sanitized) return;
    const chars = sanitized.split('').slice(0, letterInputs.length - index);
    chars.forEach((char, offset) => {
      const targetIndex = index + offset;
      const input = letterInputs[targetIndex];
      if (input) {
        input.value = char;
      }
    });
    const nextIndex = index + chars.length;
    if (nextIndex < letterInputs.length) {
      setActiveLetter(nextIndex);
    } else {
      setActiveLetter(letterInputs.length - 1);
      letterInputs[letterInputs.length - 1]?.select();
    }
    updateActiveGuessPreview();
  }

  function hideRoundResultOverlay() {
    if (roundResultTimeoutId) {
      clearTimeout(roundResultTimeoutId);
      roundResultTimeoutId = null;
    }
    if (roundResultOverlay) {
      roundResultOverlay.classList.add('hidden');
    }
  }

  function showRoundResultOverlay(options = {}) {
    if (!roundResultOverlay) return;
    const { winnerName, correctWord, isDraw } = options;
    const message = isDraw ? 'Rodada empatada!' : (winnerName ? `Ponto para ${winnerName}!` : 'Rodada encerrada!');
    const normalizedWord = correctWord && correctWord.trim().length ? correctWord : '-----';
    if (roundResultMessageEl) {
      roundResultMessageEl.textContent = message;
    }
    if (roundResultWordEl) {
      roundResultWordEl.textContent = `Palavra: ${normalizedWord}`;
    }
    roundResultOverlay.classList.remove('hidden');
    if (roundResultTimeoutId) {
      clearTimeout(roundResultTimeoutId);
    }
    roundResultTimeoutId = setTimeout(() => {
      roundResultOverlay.classList.add('hidden');
      roundResultTimeoutId = null;
    }, 2000);
  }

  function playCountdown() {
    if (!countdownOverlay || !countdownNumberEl) {
      return Promise.resolve();
    }
    stopCountdown(true);
    countdownRunning = true;
    const sequence = ['3', '2', '1'];
    countdownOverlay.classList.remove('hidden');
    return new Promise(resolve => {
      countdownResolve = resolve;
      const stepDuration = 1000;
      const runStep = index => {
        const value = sequence[index];
        countdownNumberEl.textContent = value;
        countdownNumberEl.classList.remove('animate');
        void countdownNumberEl.offsetWidth;
        countdownNumberEl.classList.add('animate');
        if (index < sequence.length - 1) {
          const timeoutId = setTimeout(() => runStep(index + 1), stepDuration);
          countdownTimeoutIds.push(timeoutId);
        } else {
          const timeoutId = setTimeout(() => {
            stopCountdown(true);
          }, stepDuration);
          countdownTimeoutIds.push(timeoutId);
        }
      };
      runStep(0);
    });
  }

  function stopCountdown(triggerResolve = false) {
    countdownTimeoutIds.forEach(id => clearTimeout(id));
    countdownTimeoutIds = [];
    if (countdownOverlay) {
      countdownOverlay.classList.add('hidden');
    }
    if (countdownNumberEl) {
      countdownNumberEl.classList.remove('animate');
    }
    countdownRunning = false;
    const resolver = countdownResolve;
    countdownResolve = null;
    if (triggerResolve && typeof resolver === 'function') {
      resolver();
    }
  }

  function resetBoardCells(board) {
    board.attemptIndex = 0;
    board.rows.forEach(row => {
      row.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('status-green', 'status-yellow', 'status-gray', 'revealed');
      });
    });
  }

  function resetAllBoards() {
    boards.forEach(board => resetBoardCells(board));
    state.localAttempts = 0;
    updateAttemptsInfo();
  }

  function ensureBoard(player) {
    const attempts = state.attemptLimit || MAX_ATTEMPTS_FALLBACK;
    let board = boards.get(player.playerId);
    if (!board) {
      const boardEl = document.createElement('div');
      boardEl.className = 'mp-board';
      boardEl.dataset.playerId = player.playerId;

      const head = document.createElement('h3');
      const nameSpan = document.createElement('span');
      nameSpan.className = 'mp-player-name';
      const tagSpan = document.createElement('span');
      tagSpan.className = 'mp-player-tag';
      head.append(nameSpan, tagSpan);
      boardEl.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'mp-board-grid';
      const rows = [];
      for (let r = 0; r < attempts; r += 1) {
        const row = document.createElement('div');
        row.className = 'mp-row';
        const cells = [];
        for (let c = 0; c < 5; c += 1) {
          const cell = document.createElement('div');
          cell.className = 'mp-cell';
          row.appendChild(cell);
          cells.push(cell);
        }
        grid.appendChild(row);
        rows.push(cells);
      }
      boardEl.appendChild(grid);
      boardsContainer?.appendChild(boardEl);
      board = {
        root: boardEl,
        nameEl: nameSpan,
        tagEl: tagSpan,
        rows,
        attemptIndex: 0,
      };
      boards.set(player.playerId, board);
    } else if (board.rows.length !== attempts) {
      board.rows.forEach(row => row.forEach(cell => cell.remove()));
      board.root.querySelector('.mp-board-grid')?.remove();
      const grid = document.createElement('div');
      grid.className = 'mp-board-grid';
      const rows = [];
      for (let r = 0; r < attempts; r += 1) {
        const row = document.createElement('div');
        row.className = 'mp-row';
        const cells = [];
        for (let c = 0; c < 5; c += 1) {
          const cell = document.createElement('div');
          cell.className = 'mp-cell';
          row.appendChild(cell);
          cells.push(cell);
        }
        grid.appendChild(row);
        rows.push(cells);
      }
      board.root.appendChild(grid);
      board.rows = rows;
      board.attemptIndex = 0;
    }

    const tags = [];
    if (player.playerId === state.playerId) tags.push('Voce');
    if (player.isHost) tags.push('Host');
    board.nameEl.textContent = player.name;
    board.tagEl.textContent = tags.join(' | ');
    board.root.classList.toggle('you', player.playerId === state.playerId);
  }

  function removeMissingBoards(presentIds) {
    Array.from(boards.entries()).forEach(([id, board]) => {
      if (!presentIds.has(id)) {
        board.root.remove();
        boards.delete(id);
      }
    });
  }

  function renderScoreboard(players) {
    state.players = players.slice();
    const present = new Set();
    if (scoreboardList) {
      scoreboardList.innerHTML = '';
    }
    players.forEach(player => {
      present.add(player.playerId);
      ensureBoard(player);
      if (scoreboardList) {
        const li = document.createElement('li');
        li.className = 'mp-score-item';
        if (player.playerId === state.playerId) li.classList.add('you');
        if (player.isHost) li.classList.add('host');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'mp-score-name';
        nameSpan.textContent = player.name;

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'mp-score-points';
        scoreSpan.textContent = String(player.score ?? 0);

        li.append(nameSpan, scoreSpan);
        scoreboardList.appendChild(li);
      }
    });
    removeMissingBoards(present);
    if (boardsContainer) {
      players.forEach(player => {
        const board = boards.get(player.playerId);
        if (board) {
          boardsContainer.appendChild(board.root);
        }
      });
    }
  }

  function updateAttemptsInfo() {
    if (!attemptsInfoEl) return;
    const used = state.roundActive ? Math.min(state.localAttempts, state.attemptLimit) : 0;
    attemptsInfoEl.textContent = `${used}/${state.attemptLimit} tentativas`;
  }

  function resetAfterLeave() {
    state.playerId = null;
    state.roomCode = null;
    state.isHost = false;
    state.roomStatus = 'idle';
    state.roundNumber = 0;
    state.roundActive = false;
    state.localAttempts = 0;
    state.language = 'pt';
    state.roundsTarget = 3;
    state.players = [];
    boards.clear();
    boardsContainer && (boardsContainer.innerHTML = '');
    scoreboardList && (scoreboardList.innerHTML = '');
    guessForm?.classList.add('hidden');
    setRoomCode(null);
    if (roomCodeInput) {
      roomCodeInput.value = '';
    }
    hideRoundResultOverlay();
    stopCountdown(true);
    clearGuessInputs({ focus: false });
    setGuessInputsEnabled(false, { focus: false });
    updateLobbyStatus();
    if (roundInfoEl) roundInfoEl.textContent = 'Aguardando jogadores...';
    if (statusMessageEl) statusMessageEl.textContent = '';
    updateAttemptsInfo();
    toggleViews(false);
  }

  function selectedRounds() {
    const radios = roundRadioGroup?.querySelectorAll('input[name="roundsOption"]') || [];
    for (const radio of radios) {
      if (radio.checked) return Number(radio.value);
    }
    return state.roundsTarget || 3;
  }

  function setSelectedRounds(value) {
    const radios = roundRadioGroup?.querySelectorAll('input[name="roundsOption"]') || [];
    let matched = false;
    radios.forEach(radio => {
      const shouldCheck = Number(radio.value) === Number(value);
      radio.checked = shouldCheck;
      if (shouldCheck) matched = true;
    });
    if (!matched && radios.length > 0) {
      radios[1].checked = true;
      state.roundsTarget = Number(radios[1].value) || 3;
      return;
    }
    state.roundsTarget = Number(value) || 3;
  }

  function applyHostControls() {
    const canControl = state.isHost;
    const hostPanelVisible = canControl && (state.roomStatus === 'lobby' || state.roomStatus === 'finished');
    if (hostPanel) {
      hostPanel.classList.toggle('hidden', !hostPanelVisible);
      hostPanel.classList.toggle('disabled', !hostPanelVisible);
    }
    const radios = roundRadioGroup?.querySelectorAll('input[name="roundsOption"]') || [];
    radios.forEach(radio => {
      radio.disabled = !hostPanelVisible;
    });
    if (languageSelect) {
      languageSelect.disabled = !hostPanelVisible;
    }
    const enoughPlayers = state.players.length >= 2;
    if (startMatchBtn) {
      const showStart = hostPanelVisible && state.roomStatus === 'lobby';
      startMatchBtn.classList.toggle('hidden', !showStart);
      startMatchBtn.disabled = !showStart || !enoughPlayers;
    }
    if (playAgainBtn) {
      const showPlayAgain = hostPanelVisible && state.roomStatus === 'finished';
      playAgainBtn.classList.toggle('hidden', !showPlayAgain);
      playAgainBtn.disabled = !showPlayAgain;
    }
  }

  function handleRoundStarted(payload) {
    state.roundActive = true;
    state.roundNumber = payload?.roundNumber || state.roundNumber + 1;
    state.attemptLimit = payload?.maxAttempts || state.attemptLimit || MAX_ATTEMPTS_FALLBACK;
    state.tiebreakerActive = Boolean(payload?.isTiebreaker);
    resetAllBoards();
    guessForm?.classList.remove('hidden');
    hideRoundResultOverlay();
    clearGuessInputs({ focus: false });
    setGuessInputsEnabled(false, { focus: false });
    playCountdown().then(() => {
      if (!state.roundActive) return;
      clearGuessInputs();
      setGuessInputsEnabled(true);
    });
    const target = payload?.roundsTarget || state.roundsTarget || 3;
    if (roundInfoEl) {
      roundInfoEl.textContent = state.tiebreakerActive
        ? `Desempate - rodada ${state.roundNumber}`
        : `Rodada ${state.roundNumber} de ${target}`;
    }
    if (statusMessageEl) {
      statusMessageEl.textContent = state.tiebreakerActive
        ? 'Desempate em andamento. Quem acertar primeiro vence.'
        : 'Rodada iniciada. Seja rapido!';
    }
    updateAttemptsInfo();
  }

  function updateStatusAfterRound(payload) {
    if (!statusMessageEl) return;
    if (payload.draw) {
      statusMessageEl.textContent = 'Rodada empatada. Prepare-se para a proxima.';
    } else if (payload.winner) {
      statusMessageEl.textContent = `${payload.winner.name} marcou ponto!`;
    } else {
      statusMessageEl.textContent = 'Rodada encerrada.';
    }
  }

  function handleRoundResult(payload) {
    state.roundActive = false;
    setGuessInputsEnabled(false, { focus: false });
    const correctWord = (payload?.correctWord || '').toUpperCase();
    const winnerName = payload?.winner?.name || null;
    showRoundResultOverlay({
      winnerName,
      correctWord,
      isDraw: Boolean(payload?.draw),
    });
    updateStatusAfterRound(payload);
  }

  function handleMatchOver(payload) {
    state.roundActive = false;
    state.roomStatus = 'finished';
    guessForm?.classList.add('hidden');
    setGuessInputsEnabled(false, { focus: false });
    hideRoundResultOverlay();
    stopCountdown(true);
    let title = 'Partida encerrada';
    let message = 'A partida terminou.';
    if (payload?.cancelled) {
      message = 'Partida encerrada porque jogadores deixaram a sala.';
    } else if (payload?.winners && payload.winners.length === 1) {
      const winner = payload.winners[0];
      title = `Vitoria de ${winner.name}!`;
      message = `${winner.name} venceu com ${winner.score} ponto${winner.score === 1 ? '' : 's'}.`;
    } else if (payload?.winners && payload.winners.length > 1) {
      const names = payload.winners.map(w => w.name).join(', ');
      message = `Empate entre ${names}. O host pode iniciar novo desempate.`;
    }
    openModal(title, message);
    applyHostControls();
  }

  function handleMatchReset() {
    state.roomStatus = 'lobby';
    state.roundNumber = 0;
    state.roundActive = false;
    guessForm?.classList.add('hidden');
    setGuessInputsEnabled(false, { focus: false });
    hideRoundResultOverlay();
    stopCountdown(true);
    if (roundInfoEl) roundInfoEl.textContent = 'Aguardando jogadores...';
    if (statusMessageEl) statusMessageEl.textContent = 'Partida reiniciada. Aguarde o inicio.';
    resetAllBoards();
    applyHostControls();
  }

  function applyGuessToBoard(playerId, letters, statuses) {
    const board = boards.get(playerId);
    if (!board) return;
    const rowIndex = board.attemptIndex;
    if (rowIndex >= board.rows.length) return;
    const row = board.rows[rowIndex];
    statuses.forEach((status, idx) => {
      const cell = row[idx];
      cell.classList.remove('status-green', 'status-yellow', 'status-gray', 'revealed');
      if (status) {
        cell.classList.add(`status-${status}`);
        cell.classList.add('revealed');
        setTimeout(() => cell.classList.remove('revealed'), 500);
      }
      cell.textContent = letters ? letters[idx] || '' : '';
    });
    board.attemptIndex += 1;
  }

  function handleGuessResult(payload) {
    if (!payload) return;
    const letters = (payload.guess || '').split('');
    const statuses = (payload.feedback || []).map(item => item.status);
    applyGuessToBoard(payload.playerId, letters, statuses);
    if (payload.playerId === state.playerId) {
      state.localAttempts = payload.attempt || state.localAttempts;
      updateAttemptsInfo();
      if (!state.roundActive || state.localAttempts >= state.attemptLimit) {
        setGuessInputsEnabled(false, { focus: false });
      } else {
        clearGuessInputs();
        setGuessInputsEnabled(true);
      }
    }
  }

  function handlePeerGuess(payload) {
    if (!payload) return;
    const statuses = payload.feedback || [];
    applyGuessToBoard(payload.playerId, null, statuses);
  }

  function handleRoomUpdate(payload) {
    if (!payload) return;
    if (payload.code && payload.code !== state.roomCode) {
      state.roomCode = payload.code;
      setRoomCode(payload.code);
    }
    state.roomStatus = payload.status || state.roomStatus;
    state.attemptLimit = payload.maxAttempts || state.attemptLimit || MAX_ATTEMPTS_FALLBACK;
    state.tiebreakerActive = Boolean(payload.tiebreakerActive);
    state.isHost = payload.hostId === state.playerId;
    state.language = payload.language || state.language;
    if (payload.roundsTarget) {
      setSelectedRounds(payload.roundsTarget);
    }
    renderScoreboard(payload.players || []);
    if (languageSelect) {
      languageSelect.value = state.language;
    }
    applyHostControls();
    updateLobbyStatus();
    if (state.roomStatus !== 'playing') {
      state.roundActive = false;
      guessForm?.classList.add('hidden');
      hideRoundResultOverlay();
      stopCountdown(true);
      clearGuessInputs({ focus: false });
      setGuessInputsEnabled(false, { focus: false });
      if (state.roomStatus === 'lobby') {
        if (statusMessageEl) {
          statusMessageEl.textContent = state.players.length >= 2
            ? 'Tudo pronto. O host pode iniciar a partida.'
            : 'Aguardando jogadores entrarem na sala.';
        }
        if (roundInfoEl) roundInfoEl.textContent = 'Sala pronta para jogar.';
      }
      if (state.roomStatus === 'finished') {
        if (statusMessageEl) statusMessageEl.textContent = 'Partida encerrada. Aguarde o host.';
      }
    }
    updateAttemptsInfo();
  }

  function handleSettingsUpdated(payload) {
    if (!payload) return;
    if (payload.roundsTarget) {
      setSelectedRounds(payload.roundsTarget);
    }
    if (payload.language) {
      state.language = payload.language;
      if (languageSelect) languageSelect.value = state.language;
    }
    showToast('Configuracoes atualizadas.');
  }

  function handleTiebreakerStart(payload) {
    state.tiebreakerActive = true;
    const leaders = (payload?.leaders || []).map(p => p.name).join(', ');
    if (statusMessageEl) statusMessageEl.textContent = `Empate entre ${leaders}. Rodada extra!`;
    showToast('Empate detectado. Iniciando desempate.');
  }

  function handleTiebreakerPending(payload) {
    const leaders = (payload?.leaders || []).map(p => p.name).join(', ');
    if (statusMessageEl) statusMessageEl.textContent = `Ainda empatado entre ${leaders}. Mais uma rodada!`;
  }

  function emitUpdateSettings(partial) {
    if (!state.isHost || !state.roomCode) return;
    socket.emit('update_settings', {
      code: state.roomCode,
      ...partial,
    });
  }

  function handleCreateRoom() {
    if (!socketLibraryLoaded) {
      showToast('Multiplayer indisponivel. Reinicie com o servidor ativo.');
      return;
    }
    if (!socketConnectionEstablished && typeof socket.connect === 'function') {
      socket.connect();
      showToast('Conectando ao servidor... tente novamente em instantes.');
      return;
    }
    const name = sanitizeName(displayNameInput?.value);
    if (!name) {
      showToast('Informe um nome para jogar.');
      displayNameInput?.focus();
      return;
    }
    const rounds = state.roundsTarget || 3;
    const lang = state.language || 'pt';
    createRoomBtn.disabled = true;
    joinRoomBtn.disabled = true;
    socket.emit('create_room', { name, rounds, lang });
    setTimeout(() => {
      createRoomBtn.disabled = false;
      joinRoomBtn.disabled = false;
    }, 1200);
  }

  function handleJoinRoom() {
    if (!socketLibraryLoaded) {
      showToast('Multiplayer indisponivel. Reinicie com o servidor ativo.');
      return;
    }
    if (!socketConnectionEstablished && typeof socket.connect === 'function') {
      socket.connect();
      showToast('Conectando ao servidor... tente novamente em instantes.');
      return;
    }
    const name = sanitizeName(displayNameInput?.value);
    if (!name) {
      showToast('Informe um nome para jogar.');
      displayNameInput?.focus();
      return;
    }
    const code = sanitizeCode(roomCodeInput?.value);
    if (roomCodeInput) {
      roomCodeInput.value = code;
    }
    if (!code || code.length < 4) {
      showToast('Informe um codigo de sala valido.');
      roomCodeInput?.focus();
      return;
    }
    joinRoomBtn.disabled = true;
    createRoomBtn.disabled = true;
    socket.emit('join_room', { name, code });
    setTimeout(() => {
      joinRoomBtn.disabled = false;
      createRoomBtn.disabled = false;
    }, 1200);
  }

  function handleGuessSubmit(event) {
    event.preventDefault();
    if (!state.roundActive || !state.roomCode) {
      showToast('Aguardando proxima rodada.');
      return;
    }
    if (!letterInputs.length) return;
    const incompleteIndex = letterInputs.findIndex(input => !input.value || input.value.trim().length === 0);
    if (incompleteIndex !== -1) {
      showToast('Preencha todas as letras antes de enviar.');
      setActiveLetter(incompleteIndex);
      return;
    }
    const guess = getCurrentGuessValue();
    if (guess.length !== letterInputs.length) {
      showToast('Digite uma palavra com 5 letras.');
      setActiveLetter(0);
      return;
    }
    socket.emit('submit_guess', {
      code: state.roomCode,
      guess: guess.toLowerCase(),
    });
    setGuessInputsEnabled(false, { focus: false });
  }

  function handleStartMatch() {
    if (!state.isHost || !state.roomCode) return;
    const rounds = selectedRounds();
    const lang = languageSelect?.value || state.language;
    socket.emit('start_game', { code: state.roomCode, rounds, lang });
  }

  function handlePlayAgain() {
    if (!state.isHost || !state.roomCode) return;
    const rounds = selectedRounds();
    socket.emit('play_again', { code: state.roomCode, rounds });
  }

  function leaveRoom() {
    if (!state.roomCode) {
      resetAfterLeave();
      return;
    }
    socket.emit('leave_room', { code: state.roomCode });
  }

  function handleRoomCreated(payload) {
    state.playerId = payload.playerId;
    state.roomCode = payload.code;
    state.isHost = true;
    state.roomStatus = 'lobby';
    state.language = payload.language || state.language || 'pt';
    state.roundsTarget = payload.roundsTarget || state.roundsTarget || 3;
    setSelectedRounds(state.roundsTarget);
    if (languageSelect) languageSelect.value = state.language;
    setRoomCode(state.roomCode);
    toggleViews(true);
    clearGuessInputs({ focus: false });
    setGuessInputsEnabled(false, { focus: false });
    showToast('Sala criada! Compartilhe o codigo.');
    applyHostControls();
  }

  function handleRoomJoined(payload) {
    state.playerId = payload.playerId;
    state.roomCode = payload.code;
    state.isHost = Boolean(payload.host);
    state.roomStatus = 'lobby';
    if (payload.language) {
      state.language = payload.language;
      if (languageSelect) languageSelect.value = state.language;
    }
    setRoomCode(state.roomCode);
    toggleViews(true);
    clearGuessInputs({ focus: false });
    setGuessInputsEnabled(false, { focus: false });
    showToast('Voce entrou na sala!');
    applyHostControls();
  }

  function handleLeftRoom() {
    showToast('Voce saiu da sala.');
    resetAfterLeave();
  }

  function copyRoomCode() {
    if (!state.roomCode) return;
    navigator.clipboard.writeText(state.roomCode)
      .then(() => showToast('Codigo copiado!'))
      .catch(() => showToast('Nao foi possivel copiar.', { duration: 1800 }));
  }

  createRoomBtn?.addEventListener('click', handleCreateRoom);
  joinRoomBtn?.addEventListener('click', handleJoinRoom);
  leaveRoomBtn?.addEventListener('click', leaveRoom);
  copyCodeBtn?.addEventListener('click', copyRoomCode);

  guessForm?.addEventListener('submit', handleGuessSubmit);
  letterInputs.forEach((input, index) => {
    input.dataset.index = String(index);
    input.addEventListener('focus', () => {
      activeLetterIndex = index;
      input.select();
    });
    input.addEventListener('input', event => handleLetterInputEvent(event, index));
    input.addEventListener('keydown', event => handleLetterKeyDownEvent(event, index));
    input.addEventListener('click', () => setActiveLetter(index));
    input.addEventListener('paste', event => handleLetterPaste(event, index));
  });
  setGuessInputsEnabled(false, { focus: false });
  clearGuessInputs({ focus: false });

  const roundRadios = roundRadioGroup?.querySelectorAll('input[name="roundsOption"]') || [];
  roundRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (!state.isHost) {
        setSelectedRounds(state.roundsTarget);
        showToast('Apenas o host pode alterar.');
        return;
      }
      emitUpdateSettings({ rounds: Number(radio.value) });
    });
  });

  languageSelect?.addEventListener('change', () => {
    if (!state.isHost) {
      languageSelect.value = state.language;
      showToast('Apenas o host pode alterar.');
      return;
    }
    emitUpdateSettings({ lang: languageSelect.value });
  });

  const savedTheme = (() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY);
    } catch (_) {
      return null;
    }
  })();
  applyTheme(savedTheme === 'light' ? 'light' : 'dark');
  themeToggleBtn?.addEventListener('click', () => {
    applyTheme(currentTheme === 'light' ? 'dark' : 'light');
  });

  startMatchBtn?.addEventListener('click', handleStartMatch);
  playAgainBtn?.addEventListener('click', handlePlayAgain);
  closeModalBtn?.addEventListener('click', closeModal);
  modalOverlay?.addEventListener('click', (event) => {
    if (event.target === modalOverlay) {
      closeModal();
    }
  });

  socket.on('room_created', handleRoomCreated);
  socket.on('room_joined', handleRoomJoined);
  socket.on('left_room', handleLeftRoom);

  socket.on('room_update', handleRoomUpdate);
  socket.on('settings_updated', handleSettingsUpdated);
  socket.on('host_change', data => {
    if (!data) return;
    state.isHost = data.playerId === state.playerId;
    applyHostControls();
    const player = state.players.find(p => p.playerId === data.playerId);
    if (player) {
      showToast(player.playerId === state.playerId
        ? 'Voce agora e o host.'
        : player.name + ' agora e o host.');
    } else if (state.isHost) {
      showToast('Voce agora e o host.');
    } else {
      showToast('Host atualizado.');
    }
  });

  socket.on('player_joined', payload => {
    if (payload?.name) showToast(`${payload.name} entrou na sala.`);
  });
  socket.on('player_left', payload => {
    if (payload?.name) showToast(`${payload.name} saiu da sala.`);
  });

  socket.on('match_started', () => {
    if (statusMessageEl) statusMessageEl.textContent = 'Partida iniciada!';
    showToast('Partida iniciada!');
  });
  socket.on('round_started', handleRoundStarted);
  socket.on('guess_result', handleGuessResult);
  socket.on('peer_guess', handlePeerGuess);
  socket.on('round_result', handleRoundResult);
  socket.on('match_over', handleMatchOver);
  socket.on('match_reset', handleMatchReset);
  socket.on('tiebreaker_start', handleTiebreakerStart);
  socket.on('tiebreaker_pending', handleTiebreakerPending);

  socket.on('room_error', payload => {
    const message = payload?.error || 'Ocorreu um erro na sala.';
    showToast(message);
  });
  socket.on('guess_error', payload => {
    const message = payload?.error || 'Palpite invalido.';
    showToast(message);
    if (state.roundActive) {
      setGuessInputsEnabled(true);
      const incomplete = letterInputs.findIndex(input => !input.value);
      if (incomplete !== -1) {
        setActiveLetter(incomplete);
      } else {
        setActiveLetter(activeLetterIndex || 0);
      }
      updateActiveGuessPreview();
    }
  });

  socket.on('disconnect', () => {
    showToast('Conexao perdida. Tentando reconectar...');
  });

  socket.on('reconnect', () => {
    showToast('Reconectado ao servidor.');
  });

  window.addEventListener('beforeunload', () => {
    if (state.roomCode) {
      socket.emit('leave_room', { code: state.roomCode });
    }
  });

  toggleViews(false);
  updateAttemptsInfo();
  updateLobbyStatus();
})();


