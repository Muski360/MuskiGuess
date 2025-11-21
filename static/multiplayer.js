;(function (window) {
  const supabaseClient = window.supabaseClient;
  const wordService = window.wordService;
  const utils = window.muskiUtils;
  const fromEntities = utils?.decodeHtml || ((v) => v);
  if (!supabaseClient || !wordService || !utils) {
    console.error(fromEntities('[multiplayer] Supabase, utils.js e wordService.js s&atilde;o obrigat&oacute;rios.'));
    return;
  }
  const supabase = supabaseClient.getClient();
  const STORAGE_KEY = 'muskiGuess.multiplayer.solution';

  const ROOM_CODE_LENGTH = 6;
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  const state = {
    loggedIn: false,
    user: null,
    profile: null,
    defaultName: '',
    room: null,
    player: null,
    players: [],
    guesses: [],
    channel: null,
    currentSolution: null,
    isHost: false,
    loading: false,
    pollTimer: null,
    countdownTimer: null,
  };

  const refs = {
    entryView: document.getElementById('entryView'),
    gameView: document.getElementById('gameView'),
    scoreboardList: document.getElementById('scoreboardList'),
    boardsContainer: document.getElementById('boardsContainer'),
    roundInfo: document.getElementById('roundInfo'),
    statusMessage: document.getElementById('statusMessage'),
    attemptsInfo: document.getElementById('attemptsInfo'),
    lobbyStatus: document.getElementById('lobbyStatusText'),
    hostPanel: document.getElementById('hostPanel'),
    displayNameInput: document.getElementById('displayNameInput'),
    displayNameValue: document.getElementById('displayNameValue'),
    roomCodeInput: document.getElementById('roomCodeInput'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    loginRequiredNotice: document.getElementById('loginRequiredNotice'),
    leaveRoomBtn: document.getElementById('leaveRoomBtn'),
    roomCodeWrap: document.getElementById('roomCodeWrap'),
    roomCodeText: document.getElementById('roomCodeText'),
    copyCodeBtn: document.getElementById('copyCodeBtn'),
    roundRadioGroup: document.getElementById('roundRadioGroup'),
    languageSelect: document.getElementById('languageSelect'),
    startMatchBtn: document.getElementById('startMatchBtn'),
    playAgainBtn: document.getElementById('playAgainBtn'),
    addBotBtn: document.getElementById('addBotBtn'),
    guessForm: document.getElementById('guessForm'),
    guessLetterGrid: document.getElementById('guessLetterGrid'),
    letterInputs: Array.from(document.querySelectorAll('.mp-letter-input')),
    toast: document.getElementById('toast'),
    roundResultOverlay: document.getElementById('roundResultOverlay'),
    roundResultMessage: document.getElementById('roundResultMessage'),
    roundResultWord: document.getElementById('roundResultWord'),
    countdownOverlay: document.getElementById('countdownOverlay'),
    countdownNumber: document.getElementById('countdownNumber'),
  };

  const boards = new Map();

  init();

  function init() {
    bindUiEvents();
    bindInputEvents();
    initAuthIntegration();
    toggleGameView(false);
    updateLoginNotice();
    updateLobbyStatus(fromEntities('Crie ou entre em uma sala para come&ccedil;ar.'));
    refs.addBotBtn?.setAttribute('disabled', 'true');
    refs.addBotBtn?.classList.add('mp-btn-disabled');
    refs.addBotBtn?.setAttribute('title', fromEntities('Bots n&atilde;o est&atilde;o dispon&iacute;veis na vers&atilde;o Supabase.'));
    setGuessInputsEnabled(false);
  }

  function bindUiEvents() {
    refs.createRoomBtn?.addEventListener('click', handleCreateRoom);
    refs.joinRoomBtn?.addEventListener('click', handleJoinRoom);
    refs.leaveRoomBtn?.addEventListener('click', leaveRoom);
    refs.copyCodeBtn?.addEventListener('click', copyRoomCode);
    refs.startMatchBtn?.addEventListener('click', handleStartRound);
    refs.playAgainBtn?.addEventListener('click', handleStartRound);
    refs.guessForm?.addEventListener('submit', handleSubmitGuess);
    window.addEventListener('beforeunload', () => {
      if (state.room && state.player) {
        leaveRoom({ silent: true });
      }
    });
  }

  function bindInputEvents() {
    refs.letterInputs.forEach((input, index) => {
      input.addEventListener('input', (evt) => {
        const value = evt.target.value
          .toUpperCase()
          .replace(/[^A-Z\u00C7\u00C3\u00D5\u00C1\u00C9\u00CD\u00D3\u00DA\u00C2\u00CA\u00D4]/g, '');
        evt.target.value = value.slice(-1);
        if (value && index < refs.letterInputs.length - 1) {
          refs.letterInputs[index + 1].focus();
        }
      });
      input.addEventListener('keydown', (evt) => {
        if (evt.key === 'Backspace' && !evt.target.value && index > 0) {
          refs.letterInputs[index - 1].focus();
        }
      });
    });
  }

  function initAuthIntegration() {
    if (!window.auth) {
      state.loggedIn = false;
      updateLoginNotice();
      return;
    }
    const snapshot = window.auth.getUser ? { user: window.auth.getUser() } : null;
    handleAuthSnapshot(snapshot);
    window.auth.onAuthChange((snapshot) => {
      handleAuthSnapshot({ user: snapshot?.user || null });
    });
  }

  function handleAuthSnapshot(snapshot) {
    const newUser = snapshot?.user || null;
    state.loggedIn = !!newUser;
    state.user = newUser;
    updateLoginNotice();
    if (!state.loggedIn) {
      leaveRoom({ silent: true });
      refs.displayNameValue.textContent = '-';
      state.defaultName = '';
      return;
    }
    loadProfileDefaults();
  }

  async function loadProfileDefaults() {
    try {
      if (window.profiles?.getCurrentUserProfile) {
        const { profile } = await window.profiles.getCurrentUserProfile();
        state.profile = profile;
        state.defaultName = profile?.username || 'Jogador';
        refs.displayNameValue.textContent = state.defaultName;
        if (!refs.displayNameInput.value) {
          refs.displayNameInput.value = state.defaultName;
        }
      }
    } catch (error) {
      console.warn('[multiplayer] Falha ao carregar profile', error);
      state.defaultName = 'Jogador';
    }
  }

  function updateLoginNotice() {
    if (!refs.loginRequiredNotice) return;
    refs.loginRequiredNotice.classList.toggle('hidden', state.loggedIn);
    const disabled = !state.loggedIn;
    refs.createRoomBtn?.toggleAttribute('disabled', disabled);
    refs.joinRoomBtn?.toggleAttribute('disabled', disabled);
  }

  function toggleGameView(inMatch) {
    refs.entryView?.classList.toggle('hidden', inMatch);
    refs.gameView?.classList.toggle('hidden', !inMatch);
    refs.roomCodeWrap?.classList.toggle('hidden', !inMatch);
    refs.leaveRoomBtn?.classList.toggle('hidden', !inMatch);
    refs.guessForm?.classList.toggle('hidden', !inMatch);
    refs.playAgainBtn?.classList.toggle('hidden', !inMatch);
    if (!inMatch) {
      refs.roomCodeText.textContent = '----';
      clearGuessInputs();
      setGuessInputsEnabled(false);
    }
  }

  function updateLobbyStatus(message) {
    if (refs.lobbyStatus) {
      refs.lobbyStatus.textContent = message || '';
    }
  }

  function getHostRoundsTarget() {
    if (!refs.roundRadioGroup) return 3;
    const checked = refs.roundRadioGroup.querySelector('input[type="radio"]:checked');
    const value = Number.parseInt(checked?.value || '3', 10);
    if (!Number.isFinite(value)) return 3;
    return Math.max(1, Math.min(value, 10));
  }

  function getSelectedLanguage() {
    const value = refs.languageSelect?.value || 'pt';
    return (value || 'pt').toLowerCase() === 'en' ? 'en' : 'pt';
  }

  async function handleCreateRoom() {
    if (!ensureLoggedIn()) return;
    if (state.loading) return;
    const displayName = (refs.displayNameInput?.value || state.defaultName || 'Jogador').trim() || 'Jogador';
    const rounds = getHostRoundsTarget();
    const lang = getSelectedLanguage();
    try {
      state.loading = true;
    const payload = await createRoomInSupabase({ displayName, rounds, lang });
    state.room = payload.room;
    state.player = payload.player;
    state.isHost = true;
    state.currentSolution = null;
    toggleGameView(true);
    updateLobbyStatus('Sala criada! Aguarde os jogadores.');
    showToast(`Sala ${payload.room.code} criada.`);
    subscribeToRoom(payload.room.id);
    startRoomPolling();
    await refreshPlayers();
    refs.roomCodeText.textContent = payload.room.code;
    refs.displayNameValue.textContent = displayName;
  } catch (error) {
      console.error('[multiplayer] create room', error);
      showToast(normalizeError(error, fromEntities('N&atilde;o foi poss&iacute;vel criar a sala.')));
    } finally {
      state.loading = false;
    }
  }

  async function handleJoinRoom() {
    if (!ensureLoggedIn()) return;
    if (state.loading) return;
    const displayName = (refs.displayNameInput?.value || state.defaultName || 'Jogador').trim() || 'Jogador';
    const code = (refs.roomCodeInput?.value || '').trim().toUpperCase();
    if (code.length !== ROOM_CODE_LENGTH) {
      showToast(fromEntities('C&oacute;digo inv&aacute;lido.'));
      return;
    }
    showToast(`Conectando à sala ${code}...`);
    try {
      state.loading = true;
      const payload = await joinRoomInSupabase({ displayName, code });
      state.room = payload.room;
      state.player = payload.player;
      state.isHost = payload.room.host_id === state.user.id;
      toggleGameView(true);
      refs.roomCodeText.textContent = payload.room.code;
      refs.displayNameValue.textContent = displayName;
      updateLobbyStatus(fromEntities('Conectado &agrave; sala. Aguarde o host iniciar.'));
      showToast(`Entrou na sala ${code}.`);
      subscribeToRoom(payload.room.id);
      startRoomPolling();
      await refreshPlayers();
      await refreshGuesses();
    } catch (error) {
      console.error('[multiplayer] join room', error);
      showToast(normalizeError(error, fromEntities('N&atilde;o foi poss&iacute;vel entrar na sala.')));
      toggleGameView(false);
      cleanupRoomState();
    } finally {
      state.loading = false;
    }
  }

  function ensureLoggedIn() {
    if (state.loggedIn) return true;
    showToast(fromEntities('Fa&ccedil;a login para usar o multiplayer.'));
    if (window.auth?.openLogin) window.auth.openLogin();
    return false;
  }

  async function leaveRoom(options = {}) {
    if (!state.room || !state.player) {
      if (!options.silent) {
        showToast(fromEntities('Voc&ecirc; n&atilde;o est&aacute; em uma sala.'));
      }
      return;
    }
    try {
      await supabase.from('multiplayer_players').delete().eq('id', state.player.id);
      if (state.isHost) {
        await promoteNextHost();
      }
    } catch (error) {
      console.warn('[multiplayer] leave room', error);
    } finally {
      cleanupRoomState();
      if (!options.silent) {
        showToast(fromEntities('Voc&ecirc; saiu da sala.'));
      }
    }
  }

  async function promoteNextHost() {
    if (!state.room) return;
    const { data } = await supabase
      .from('multiplayer_players')
      .select('*')
      .eq('room_id', state.room.id)
      .order('created_at', { ascending: true });
    if (!data || data.length === 0) {
      await supabase.from('multiplayer_rooms').delete().eq('id', state.room.id);
      return;
    }
    const next = data[0];
    await supabase
      .from('multiplayer_rooms')
      .update({
        host_id: next.user_id,
        host_name: next.name,
      })
      .eq('id', state.room.id);
    await supabase
      .from('multiplayer_players')
      .update({ is_host: false })
      .eq('room_id', state.room.id);
    await supabase.from('multiplayer_players').update({ is_host: true }).eq('id', next.id);
  }

  function cleanupRoomState() {
    if (state.channel) {
      state.channel.unsubscribe();
      state.channel = null;
    }
    stopRoomPolling();
    if (state.room) {
      clearStoredSolution(state.room.id, state.room.round_number);
    }
    state.room = null;
    state.player = null;
    state.players = [];
    state.guesses = [];
    state.currentSolution = null;
    state.isHost = false;
    boards.clear();
    refs.boardsContainer.innerHTML = '';
    refs.scoreboardList.innerHTML = '';
    refs.roundInfo.textContent = fromEntities('Sala n&atilde;o iniciada');
    refs.attemptsInfo.textContent = '';
    refs.statusMessage.textContent = '';
    toggleGameView(false);
    refs.entryView?.classList.remove('hidden');
    refs.gameView?.classList.add('hidden');
    refs.guessForm?.classList.add('hidden');
    refs.playAgainBtn?.classList.add('hidden');
    refs.roomCodeWrap?.classList.add('hidden');
    updateLobbyStatus(fromEntities('Crie ou entre em uma sala para come&ccedil;ar.'));
    showToast(fromEntities('Voc&ecirc; saiu da sala.'));
  }

  async function createRoomInSupabase({ displayName, rounds, lang }) {
    const code = generateRoomCode();
    const { data: room, error: roomError } = await supabase
      .from('multiplayer_rooms')
      .insert({
        code,
        host_id: state.user.id,
        host_name: displayName,
        rounds_target: rounds,
        language: lang,
      })
      .select('*')
      .single();
    if (roomError) throw roomError;

    const { data: player, error: playerError } = await supabase
      .from('multiplayer_players')
      .insert({
        room_id: room.id,
        user_id: state.user.id,
        name: displayName,
        is_host: true,
      })
      .select('*')
      .single();
    if (playerError) throw playerError;
    return { room, player };
  }

  async function joinRoomInSupabase({ displayName, code }) {
    const { data: room, error } = await supabase
      .rpc('lookup_room_by_code', { p_code: code })
      .single();
    if (error || !room) {
      throw new Error('Sala nao encontrada.');
    }
    const { data: player, error: playerError } = await supabase
      .from('multiplayer_players')
      .upsert(
        {
          room_id: room.id,
          user_id: state.user.id,
          name: displayName,
          is_host: room.host_id === state.user.id,
        },
        { onConflict: 'room_id,user_id' }
      )
      .select('*')
      .single();
    if (playerError) throw playerError;
    return { room, player };
  }

  function generateRoomCode() {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
      code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    }
    return code;
  }

  function copyRoomCode() {
    if (!navigator.clipboard || !state.room?.code) {
      showToast(fromEntities('N&atilde;o foi poss&iacute;vel copiar o c&oacute;digo.'));
      return;
    }
    navigator.clipboard
      .writeText(state.room.code)
      .then(() => showToast(fromEntities('C&oacute;digo copiado.')))
      .catch(() => showToast(fromEntities('N&atilde;o foi poss&iacute;vel copiar o c&oacute;digo.')));
  }

  function subscribeToRoom(roomId) {
    if (state.channel) {
      state.channel.unsubscribe();
      state.channel = null;
    }
    state.channel = supabase
      .channel(`room:${roomId}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'multiplayer_rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new) {
            applyRoomUpdate(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'multiplayer_players', filter: `room_id=eq.${roomId}` },
        () => {
          refreshPlayers();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'multiplayer_guesses', filter: `room_id=eq.${roomId}` },
        (payload) => {
          handleGuessInsert(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'multiplayer_guesses', filter: `room_id=eq.${roomId}` },
        (payload) => {
          handleGuessUpdate(payload.new);
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await refreshRoom();
          await refreshPlayers();
          await refreshGuesses();
        }
      });
  }

  async function refreshRoom() {
    if (!state.room) return;
    const { data, error } = await supabase
      .from('multiplayer_rooms')
      .select('*')
      .eq('id', state.room.id)
      .single();
    if (error || !data) return;
    applyRoomUpdate(data);
  }

  async function refreshPlayers() {
    if (!state.room) return;
    const { data, error } = await supabase
      .from('multiplayer_players')
      .select('*')
      .eq('room_id', state.room.id)
      .order('created_at', { ascending: true });
    if (error || !data) return;
    state.players = data;
    if (state.player) {
      const latestSelf = data.find((player) => player.user_id === state.user?.id);
      if (latestSelf) {
        state.player = latestSelf;
        state.isHost = latestSelf.is_host || state.room.host_id === state.user?.id;
      }
    }
    renderPlayers();
  }

  async function refreshGuesses() {
    if (!state.room) return;
    const { data, error } = await supabase
      .from('multiplayer_guesses')
      .select('*')
      .eq('room_id', state.room.id)
      .eq('round_number', state.room.round_number);
    if (error || !data) return;
    state.guesses = data;
    renderGuesses();
  }

  function applyRoomUpdate(room) {
    if (!room || (state.room && room.id !== state.room.id)) {
      return;
    }
    const previousRound = state.room?.round_number || 0;
    const previousActive = state.room?.round_active || false;
    state.room = room;
    state.isHost = room.host_id === state.user?.id || state.player?.is_host;
    refs.roomCodeText.textContent = room.code;
    refs.roundInfo.textContent = room.round_active
      ? `Rodada ${room.round_number}`
      : fromEntities('Aguardando in&iacute;cio');
    refs.statusMessage.textContent = room.status === 'round_active'
      ? 'Rodada em andamento.'
      : room.status === 'round_complete'
        ? 'Rodada finalizada.'
        : 'Sala em modo lobby.';
    toggleHostControls();
    if (room.round_number !== previousRound || (room.round_active && !previousActive)) {
      resetBoardsForNewRound();
      if (!state.isHost) {
        state.currentSolution = null;
      } else if (!state.currentSolution) {
        state.currentSolution = loadStoredSolution(room.id, room.round_number);
      }
      refreshGuesses();
      evaluatePendingGuesses();
      if (room.round_active) {
        setGuessInputsEnabled(true);
        startCountdown();
      }
    }
    if (!room.round_active && room.answer_reveal) {
      clearStoredSolution(room.id, room.round_number);
      showRoundResult(room);
      setGuessInputsEnabled(false);
    } else {
      hideRoundResult();
    }
    if (!room.round_active) {
      setGuessInputsEnabled(false);
    }
    evaluatePendingGuesses();
  }

  function toggleHostControls() {
    if (!refs.hostPanel) return;
    refs.hostPanel.classList.toggle('hidden', !state.isHost);
    const disable = !state.isHost || state.room?.round_active;
    refs.hostPanel.classList.toggle('mp-host-disabled', !!state.room?.round_active);
    refs.startMatchBtn?.toggleAttribute('disabled', !state.isHost);
    refs.playAgainBtn?.toggleAttribute('disabled', disable);
  }
  function setGuessInputsEnabled(enabled) {
    refs.letterInputs.forEach((input) => {
      input.toggleAttribute('disabled', !enabled);
    });
    refs.guessForm?.classList.toggle('mp-disabled', !enabled);
  }

  function resetBoardsForNewRound() {
    refs.boardsContainer.innerHTML = '';
    boards.clear();
    state.guesses = [];
    refs.attemptsInfo.textContent = '';
  }

  async function handleStartRound() {
    if (!state.isHost) {
      showToast('Somente o host pode iniciar a rodada.');
      return;
    }
    if (!state.room) return;
    try {
      const words = await wordService.getRandomWords(state.room.language || 'pt', 1);
      const solution = (words && words[0]) || null;
      if (!solution) throw new Error('Falha ao gerar palavra.');
      state.currentSolution = solution.toUpperCase();
      const hash = await hashWord(state.currentSolution);
      const nextRoundNumber = (state.room.round_number || 0) + 1;
      storeSolutionSecret(state.room.id, nextRoundNumber, state.currentSolution);
      const { data, error } = await supabase
        .from('multiplayer_rooms')
        .update({
          round_number: nextRoundNumber,
          round_active: true,
          status: 'round_active',
          round_started_at: new Date().toISOString(),
          round_solution_hash: hash,
          round_winner_id: null,
          answer_reveal: null,
        })
        .eq('id', state.room.id)
        .select('*')
        .single();
      if (error) throw error;
      state.room = data;
      resetBoardsForNewRound();
      showToast('Rodada iniciada!');
      setGuessInputsEnabled(true);
      startCountdown();
      await refreshGuesses();
      await refreshPlayers();
      evaluatePendingGuesses();
      checkRoundCompletion();
    } catch (error) {
      console.error('[multiplayer] start round', error);
      showToast(normalizeError(error, fromEntities('N&atilde;o foi poss&iacute;vel iniciar a rodada.')));
    }
  }

  async function handleSubmitGuess(event) {
    event.preventDefault();
    if (!state.room || !state.player) return;
    if (!state.room.round_active) {
      showToast(fromEntities('A rodada ainda n&atilde;o come&ccedil;ou.'));
      return;
    }
    const guess = getCurrentGuess();
    if (guess.length !== 5) {
      showToast('Digite uma palavra de 5 letras.');
      return;
    }
    try {
      const attemptNumber = getAttemptNumberForPlayer(state.player.id) + 1;
      if (attemptNumber > (state.room.attempt_limit || 6)) {
        showToast(fromEntities('Voc&ecirc; j&aacute; usou todas as tentativas.'));
        return;
      }
      const { error } = await supabase.from('multiplayer_guesses').insert({
        room_id: state.room.id,
        player_id: state.player.id,
        round_number: state.room.round_number,
        attempt_number: attemptNumber,
        guess,
      });
      if (error) throw error;
      clearGuessInputs();
      await refreshGuesses();
      evaluatePendingGuesses();
      checkRoundCompletion();
    } catch (err) {
      console.error('[multiplayer] submit guess', err);
      showToast(normalizeError(err, fromEntities('N&atilde;o foi poss&iacute;vel enviar o palpite.')));
    }
  }

  function getAttemptNumberForPlayer(playerId) {
    return state.guesses.filter(
      (guess) => guess.player_id === playerId && guess.round_number === state.room.round_number
    ).length;
  }

  function getCurrentGuess() {
    return refs.letterInputs.map((input) => (input.value || '').toUpperCase()).join('');
  }

  function clearGuessInputs() {
    refs.letterInputs.forEach((input) => {
      input.value = '';
    });
    refs.letterInputs[0]?.focus();
  }

  function handleGuessInsert(row) {
    if (!row || !state.room) return;
    state.guesses.push(row);
    renderGuesses();
    if (state.isHost && !row.feedback && state.currentSolution) {
      evaluatePendingGuess(row);
    }
  }

  function handleGuessUpdate(row) {
    if (!row) return;
    const index = state.guesses.findIndex((guess) => guess.id === row.id);
    if (index !== -1) {
      state.guesses[index] = row;
      renderGuesses();
    }
  }

  async function evaluatePendingGuess(row) {
    try {
      const feedback = buildFeedback(row.guess, state.currentSolution);
      const isCorrect = feedback.every((item) => item.status === 'correct');
      await supabase
        .from('multiplayer_guesses')
        .update({
          feedback,
          is_correct: isCorrect,
        })
        .eq('id', row.id);
      if (isCorrect) {
        await supabase.rpc('increment_player_score', { p_player_id: row.player_id }).catch(() => {});
        await supabase
          .from('multiplayer_rooms')
          .update({
            round_active: false,
            status: 'round_complete',
            round_winner_id: row.player_id,
            answer_reveal: state.currentSolution,
          })
          .eq('id', state.room.id);
        setGuessInputsEnabled(false);
        showRoundResult({
          round_winner_id: row.player_id,
          answer_reveal: state.currentSolution,
        });
      } else {
        checkRoundCompletion();
      }
    } catch (error) {
      console.error('[multiplayer] evaluate guess', error);
    }
  }

  function evaluatePendingGuesses() {
    if (!state.isHost || !state.currentSolution) return;
    const pending = state.guesses.filter((row) => row && !row.feedback);
    pending.forEach((row) => evaluatePendingGuess(row));
  }

  function buildFeedback(guess, answer) {
    const result = [];
    const answerLetters = answer.split('');
    const used = answerLetters.map(() => false);
    const guessLetters = guess.split('');
    for (let i = 0; i < 5; i += 1) {
      const letter = guessLetters[i];
      if (letter === answerLetters[i]) {
        result[i] = { letter, status: 'correct' };
        used[i] = true;
      } else {
        result[i] = { letter, status: 'absent' };
      }
    }
    for (let i = 0; i < 5; i += 1) {
      if (result[i].status === 'correct') continue;
      const letter = guessLetters[i];
      const idx = answerLetters.findIndex((ansLetter, pos) => !used[pos] && ansLetter === letter);
      if (idx !== -1) {
        used[idx] = true;
        result[i].status = 'present';
      }
    }
    return result;
  }

  function renderPlayers() {
    refs.scoreboardList.innerHTML = '';
    const fragment = document.createDocumentFragment();
    state.players.forEach((player) => {
      const item = document.createElement('li');
      item.className = 'mp-scoreboard-item';
      item.innerHTML = `
        <div class="mp-scoreboard-name">
          <span>${utils.decodeHtml(player.name)}</span>
          ${player.is_host ? '<span class="mp-scoreboard-pill">HOST</span>' : ''}
        </div>
        <div class="mp-scoreboard-score">${player.score || 0} pts</div>
      `;
      fragment.appendChild(item);
      ensureBoardForPlayer(player);
    });
    refs.scoreboardList.appendChild(fragment);
  }

  function renderGuesses() {
    const attempts = state.guesses.filter((guess) => guess.player_id === state.player?.id);
    refs.attemptsInfo.textContent = attempts.length
      ? fromEntities(`Voc&ecirc; usou ${attempts.length} de ${(state.room?.attempt_limit || 6)} tentativas`)
      : '';
    state.guesses.forEach((guess) => {
      applyGuessToBoard(guess);
    });
    evaluatePendingGuesses();
  }

  function ensureBoardForPlayer(player) {
    if (boards.has(player.id) || !state.room) return;
    const boardEl = document.createElement('div');
    boardEl.className = 'mp-board';
    boardEl.dataset.playerId = player.id;
    const title = document.createElement('div');
    title.className = 'mp-board-title';
    title.textContent = player.name;
    boardEl.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'mp-board-grid';
    const rows = state.room.attempt_limit || 6;
    for (let i = 0; i < rows; i += 1) {
      const row = document.createElement('div');
      row.className = 'mp-row';
      for (let j = 0; j < 5; j += 1) {
        const cell = document.createElement('div');
        cell.className = 'mp-cell';
        cell.textContent = '';
        row.appendChild(cell);
      }
      grid.appendChild(row);
    }
    boardEl.appendChild(grid);
    refs.boardsContainer.appendChild(boardEl);
    boards.set(player.id, { root: boardEl, grid });
  }

  function applyGuessToBoard(guess) {
    const entry = boards.get(guess.player_id);
    if (!entry) return;
    const rows = Array.from(entry.grid.querySelectorAll('.mp-row'));
    const rowIndex = Math.max(0, guess.attempt_number - 1);
    const rowEl = rows[rowIndex];
    if (!rowEl) return;
    const shouldHideLetters = guess.player_id !== state.player?.id;
    for (let i = 0; i < 5; i += 1) {
      const cell = rowEl.children[i];
      const letter = guess.guess[i] || '';
      cell.textContent = shouldHideLetters ? '' : (letter || '');
      cell.classList.remove('status-green', 'status-yellow', 'status-gray', 'revealed');
      if (guess.feedback && guess.feedback[i]) {
        const status = guess.feedback[i].status;
        if (status === 'correct') cell.classList.add('status-green', 'revealed');
        if (status === 'present') cell.classList.add('status-yellow', 'revealed');
        if (status === 'absent') cell.classList.add('status-gray', 'revealed');
      }
    }
  }

  function showRoundResult(room) {
    if (!refs.roundResultOverlay) return;
    const winner = state.players.find((player) => player.id === room.round_winner_id);
    refs.roundResultMessage.textContent = winner
      ? `${winner.name} venceu a rodada!`
      : 'Rodada finalizada.';
    refs.roundResultWord.textContent = room.answer_reveal || '';
    refs.roundResultOverlay.classList.remove('hidden');
  }

  function hideRoundResult() {
    if (!refs.roundResultOverlay) return;
    refs.roundResultOverlay.classList.add('hidden');
  }

  function startCountdown() {
    if (!refs.countdownOverlay || !refs.countdownNumber) return;
    refs.countdownOverlay.style.display = 'flex';
    refs.countdownOverlay.style.opacity = '1';
    refs.countdownOverlay.classList.remove('hidden');
    const sequence = ['3', '2', '1'];
    sequence.forEach((num, idx) => {
      setTimeout(() => {
        refs.countdownNumber.textContent = num;
      }, idx * 600);
    });
    setTimeout(() => {
      refs.countdownOverlay.classList.add('hidden');
      refs.countdownOverlay.style.display = 'none';
      refs.countdownOverlay.style.opacity = '0';
      refs.countdownNumber.textContent = '3';
      refs.letterInputs[0]?.focus();
    }, sequence.length * 600 + 200);
  }

  function normalizeError(err, fallback) {
    return utils.normalizeError(err, fallback);
  }

  function showToast(message) {
    if (!refs.toast) return;
    refs.toast.textContent = message;
    refs.toast.classList.remove('hidden');
    setTimeout(() => refs.toast.classList.add('hidden'), 2000);
  }

  async function hashWord(word) {
    if (!word) return null;
    const data = new TextEncoder().encode(word.toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function buildSolutionKey(roomId, roundNumber) {
    return `${STORAGE_KEY}:${roomId}:${roundNumber}`;
  }

  function storeSolutionSecret(roomId, roundNumber, value) {
    try {
      sessionStorage.setItem(buildSolutionKey(roomId, roundNumber), value || '');
    } catch (error) {
      console.warn(fromEntities('[multiplayer] Falha ao persistir solu&ccedil;&atilde;o'), error);
    }
  }

  function loadStoredSolution(roomId, roundNumber) {
    try {
      return sessionStorage.getItem(buildSolutionKey(roomId, roundNumber)) || null;
    } catch (error) {
      return null;
    }
  }

  function clearStoredSolution(roomId, roundNumber) {
    try {
      sessionStorage.removeItem(buildSolutionKey(roomId, roundNumber));
    } catch (error) {
      /* ignore */
    }
  }

  function startRoomPolling() {
    stopRoomPolling();
    state.pollTimer = setInterval(() => {
      refreshRoom();
      refreshPlayers();
      if (state.room?.round_active) {
        refreshGuesses();
        evaluatePendingGuesses();
      }
    }, 500);
  }

  function checkRoundCompletion() {
    if (!state.isHost || !state.room?.round_active) return;
    const maxAttempts = state.room.attempt_limit || 6;
    const exhausted = state.players.every((player) => getAttemptNumberForPlayer(player.id) >= maxAttempts);
    if (exhausted) {
      finishRound(null);
    }
  }

  async function finishRound(winnerPlayerId) {
    try {
      const payload = {
        round_active: false,
        status: 'round_complete',
        round_winner_id: winnerPlayerId,
        answer_reveal: state.currentSolution,
      };
      await supabase.from('multiplayer_rooms').update(payload).eq('id', state.room.id);
      showRoundResult({
        round_winner_id: winnerPlayerId,
        answer_reveal: state.currentSolution,
      });
      setGuessInputsEnabled(false);
    } catch (error) {
      console.error('[multiplayer] finishRound', error);
    }
  }

  function stopRoomPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }
})(window);
