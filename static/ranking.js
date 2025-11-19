;(function (window) {
  const utils = window.muskiUtils;
  const supabaseClient = window.supabaseClient;
  if (!utils || !supabaseClient) {
    throw new Error('utils.js e supabaseClient.js precisam ser carregados antes de ranking.js');
  }

  const MODES = ['total', 'classic', 'dupleto', 'quapleto'];
  const MODE_LABELS = {
    total: 'Total',
    classic: utils.decodeHtml('Cl&aacute;ssico'),
    dupleto: 'Dupleto',
    quapleto: 'Quapleto',
  };

  const state = {
    selected: MODES[0],
    cache: {},
    loading: false,
    loadedAt: null,
    error: null,
    scrollLocked: false,
  };

  const refs = {
    trigger: null,
    modal: null,
    closeBtn: null,
    list: null,
    status: null,
    tabs: [],
    updated: null,
  };

  function lockScroll() {
    if (state.scrollLocked) return;
    document.body.classList.add('leaderboard-open');
    state.scrollLocked = true;
  }

  function unlockScroll() {
    if (!state.scrollLocked) return;
    document.body.classList.remove('leaderboard-open');
    state.scrollLocked = false;
  }

  function setStatus(message, isError = false) {
    if (!refs.status) return;
    refs.status.textContent = message || '';
    refs.status.classList.toggle('error', Boolean(message) && isError);
  }

  function renderList() {
    if (!refs.list) return;
    refs.list.innerHTML = '';
    const modeData = state.cache[state.selected] || [];
    if (state.error) {
      const p = document.createElement('p');
      p.className = 'leaderboard-empty';
      p.textContent = state.error;
      refs.list.appendChild(p);
      return;
    }
    if (state.loading) {
      const p = document.createElement('p');
      p.className = 'leaderboard-empty';
      p.textContent = 'Carregando ranking...';
      refs.list.appendChild(p);
      return;
    }
    if (!modeData.length) {
      const p = document.createElement('p');
      p.className = 'leaderboard-empty';
      p.textContent = 'Nenhum jogador encontrado ainda.';
      refs.list.appendChild(p);
      return;
    }

    const fragment = document.createDocumentFragment();
    modeData.forEach((row, index) => {
      const item = document.createElement('div');
      item.className = 'leaderboard-item';

      const rank = document.createElement('span');
      rank.className = 'leaderboard-rank';
      rank.textContent = index + 1;

      const player = document.createElement('div');
      player.className = 'leaderboard-player';

      const name = document.createElement('p');
      name.className = 'leaderboard-name';
      name.textContent = row.profile.username || 'Jogador';

      const meta = document.createElement('p');
      meta.className = 'leaderboard-meta';
      const tag = row.profile.tag ? ` • ${row.profile.tag}` : '';
      meta.textContent = `${row.wins} vitórias · ${row.games} jogos${tag}`;

      const lvl = document.createElement('p');
      lvl.className = 'leaderboard-level';
      lvl.textContent = `Lvl ${row.profile.level} · ${row.profile.experience} XP`;

      player.appendChild(name);
      player.appendChild(meta);
      player.appendChild(lvl);
      item.appendChild(rank);
      item.appendChild(player);
      fragment.appendChild(item);
    });
    refs.list.appendChild(fragment);
  }

  function updateTabs() {
    refs.tabs.forEach((tab) => {
      const isActive = tab.dataset.mode === state.selected;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  async function fetchRanking(mode) {
    const supabase = supabaseClient.getClient();
    const { data, error } = await supabase
      .from('stats')
      .select(
        'user_id, mode, num_wins, num_games, profiles:profiles!stats_user_id_fkey(username, level, experience, tag)'
      )
      .eq('mode', mode)
      .order('num_wins', { ascending: false })
      .order('num_games', { ascending: false })
      .limit(100);

    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const mapped = rows
      .map((row) => ({
        userId: row.user_id,
        mode: row.mode,
        wins: row.num_wins,
        games: row.num_games,
        profile: utils.publicProfile(row.profiles),
      }))
      .filter((row) => row.profile.username);
    utils.testLog(`ranking.fetch.${mode}`);
    return mapped;
  }

  async function loadMode(mode) {
    if (state.loading) return;
    state.loading = true;
    state.error = null;
    setStatus('Carregando ranking...');
    renderList();
    try {
      const data = await fetchRanking(mode);
      state.cache[mode] = data;
      state.loadedAt = new Date();
      setStatus('');
    } catch (err) {
      state.error = utils.normalizeError(err, 'Não foi possível carregar o ranking.');
      setStatus(state.error, true);
    } finally {
      state.loading = false;
      renderList();
      updateTimestamp();
    }
  }

  function updateTimestamp() {
    if (!refs.updated) return;
    if (!state.loadedAt) {
      refs.updated.textContent = '';
      return;
    }
    const formatted = state.loadedAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    refs.updated.textContent = `Atualizado às ${formatted}`;
  }

  function openModal(event) {
    if (event) event.preventDefault();
    if (!refs.modal) return;
    refs.modal.classList.remove('hidden');
    refs.modal.setAttribute('aria-hidden', 'false');
    lockScroll();
    if (!state.cache[state.selected]) {
      loadMode(state.selected);
    } else {
      renderList();
      updateTimestamp();
    }
  }

  function closeModal() {
    if (!refs.modal) return;
    refs.modal.classList.add('hidden');
    refs.modal.setAttribute('aria-hidden', 'true');
    unlockScroll();
  }

  function handleTabClick(event) {
    const mode = event.currentTarget?.dataset?.mode;
    if (!mode || mode === state.selected) return;
    state.selected = mode;
    updateTabs();
    renderList();
    if (!state.cache[mode]) {
      loadMode(mode);
    }
  }

  function handleBackdropClick(event) {
    if (event.target === refs.modal) {
      closeModal();
    }
  }

  function handleEscape(event) {
    if (event.key === 'Escape') {
      closeModal();
    }
  }

  function init() {
    refs.trigger = document.getElementById('leaderboardBtn');
    refs.modal = document.getElementById('leaderboardModal');
    if (!refs.trigger || !refs.modal) return;
    refs.closeBtn = refs.modal.querySelector('[data-leaderboard-close]');
    refs.list = document.getElementById('leaderboardList');
    refs.status = document.getElementById('leaderboardStatus');
    refs.updated = document.getElementById('leaderboardUpdated');
    refs.tabs = Array.from(refs.modal.querySelectorAll('.leaderboard-tab'));

    refs.trigger.addEventListener('click', openModal);
    refs.closeBtn?.addEventListener('click', closeModal);
    refs.modal.addEventListener('click', handleBackdropClick);
    document.addEventListener('keydown', handleEscape);
    refs.tabs.forEach((tab) => tab.addEventListener('click', handleTabClick));
    updateTabs();
    renderList();
    utils.testLog('ranking.init');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
