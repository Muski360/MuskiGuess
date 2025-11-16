;(function () {
  const htmlDecoder = document.createElement('textarea');
  const fromEntities = (str = '') => {
    htmlDecoder.innerHTML = str;
    return htmlDecoder.value;
  };

  const MODES = ['total', 'classic', 'dupleto', 'quapleto'];
  const MODE_LABELS = {
    total: 'Total',
    classic: fromEntities('Cl&aacute;ssico'),
    dupleto: 'Dupleto',
    quapleto: 'Quapleto',
  };

  const state = {
    selected: MODES[0],
    data: {},
    loading: false,
    loaded: false,
    updatedAt: null,
    error: null,
    scrollLocked: false,
    lenisPaused: false,
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

  function getLenisInstance() {
    if (typeof window === 'undefined') return null;
    return window.__lenisInstance || null;
  }

  function pauseLenis() {
    if (state.lenisPaused) return;
    const lenis = getLenisInstance();
    if (lenis && typeof lenis.stop === 'function') {
      try {
        lenis.stop();
        state.lenisPaused = true;
      } catch (err) {
        console.warn('[leaderboard] Failed to pause smooth scroll:', err);
      }
    }
  }

  function resumeLenis() {
    if (!state.lenisPaused) return;
    const lenis = getLenisInstance();
    if (lenis && typeof lenis.start === 'function') {
      try {
        lenis.start();
      } catch (err) {
        console.warn('[leaderboard] Failed to resume smooth scroll:', err);
      }
    }
    state.lenisPaused = false;
  }

  function lockBackgroundScroll() {
    if (state.scrollLocked) return;
    state.scrollLocked = true;
    document.body.classList.add('leaderboard-open');
    pauseLenis();
  }

  function unlockBackgroundScroll() {
    if (!state.scrollLocked) return;
    state.scrollLocked = false;
    document.body.classList.remove('leaderboard-open');
    resumeLenis();
  }

  function isScrollingInsideList(target) {
    if (!refs.list) return false;
    return target === refs.list || refs.list.contains(target);
  }

  function preventBackgroundScroll(event) {
    if (!state.scrollLocked) return;
    if (isScrollingInsideList(event.target)) {
      return;
    }
    event.preventDefault();
  }

  function setupListIsolation() {
    if (!refs.list) return;
    refs.list.setAttribute('data-lenis-prevent', 'true');
    refs.list.setAttribute('data-lenis-prevent-wheel', 'true');
    refs.list.setAttribute('data-lenis-prevent-touch', 'true');
  }

  function setStatus(message, isError = false) {
    if (!refs.status) return;
    refs.status.textContent = message || '';
    refs.status.classList.toggle('error', Boolean(message) && isError);
  }

  function updateTimestamp() {
    if (!refs.updated) return;
    if (!state.updatedAt) {
      refs.updated.textContent = '';
      return;
    }
    const timestamp = new Date(state.updatedAt);
    if (Number.isNaN(timestamp.getTime())) {
      refs.updated.textContent = '';
      return;
    }
    const formatted = timestamp.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    refs.updated.textContent = fromEntities(`Atualizado &agrave;s ${formatted}`);
  }

  function renderList() {
    if (!refs.list) return;
    refs.list.innerHTML = '';
    const rows = state.data[state.selected] || [];
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'leaderboard-empty';
      empty.textContent = state.loading
        ?'Carregando ranking...'
        : fromEntities('Nenhuma vit&oacute;ria registrada para este modo.');
      refs.list.appendChild(empty);
      return;
    }
    const list = document.createElement('ol');
    list.className = 'leaderboard-rows';
    list.setAttribute(
      'aria-label',
      `Ranking modo ${MODE_LABELS[state.selected] || state.selected}`
    );
    rows.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'leaderboard-row';
      if (entry.rank && entry.rank <= 3) {
        item.classList.add(`top-${entry.rank}`);
      }

      const rank = document.createElement('span');
      rank.className = 'leaderboard-rank';
      rank.textContent = entry.rank ? entry.rank : '-';

      const player = document.createElement('div');
      player.className = 'leaderboard-player';

      const name = document.createElement('span');
      name.className = 'leaderboard-name';
      name.textContent = entry.username || fromEntities('An&ocirc;nimo');
      if (entry.tag) {
        const badge = document.createElement('span');
        badge.className = 'leaderboard-tag';
        const value = String(entry.tag).trim();
        badge.textContent = value.toUpperCase();
        if (value.toUpperCase() === 'ADMIN') {
          badge.classList.add('is-admin');
        }
        name.appendChild(badge);
      }

      const meta = document.createElement('span');
      meta.className = 'leaderboard-meta';
      const wins = entry.wins ?? 0;
      const games = entry.games ?? 0;
      const rate =
        typeof entry.winRate === 'number'
          ?entry.winRate.toFixed(1).replace('.0', '')
          : '0';
      meta.textContent = fromEntities(`${wins} vit&oacute;ria${wins === 1 ? '' : 's'} &bull; ${games} jogo${
        games === 1 ? '' : 's'
      } &bull; ${rate}% WR`);

      player.appendChild(name);
      player.appendChild(meta);

      item.appendChild(rank);
      item.appendChild(player);
      list.appendChild(item);
    });
    refs.list.appendChild(list);
  }

  function setSelectedMode(mode) {
    if (!MODES.includes(mode)) return;
    state.selected = mode;
    refs.tabs.forEach((tab) => {
      const isActive = tab.dataset.mode === mode;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ?'true' : 'false');
    });
    renderList();
  }

  async function fetchLeaderboard() {
    if (state.loading) return;
    state.loading = true;
    setStatus('Carregando ranking...');
    try {
      const response = await fetch('/api/leaderboard');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || fromEntities('N&atilde;o foi poss&iacute;vel carregar o ranking.'));
      }
      const leaderboard = payload?.leaderboard || {};
      state.data = {
        total: leaderboard.total || [],
        classic: leaderboard.classic || [],
        dupleto: leaderboard.dupleto || [],
        quapleto: leaderboard.quapleto || [],
      };
      state.updatedAt = payload?.generatedAt || new Date().toISOString();
      state.loaded = true;
      state.error = null;
      setStatus('');
      updateTimestamp();
      renderList();
    } catch (err) {
      state.error = err?.message || 'Erro desconhecido.';
      setStatus(state.error, true);
      renderList();
    } finally {
      state.loading = false;
    }
  }

  function openModal(event) {
    if (event) event.preventDefault();
    if (!refs.modal) return;
    refs.modal.classList.remove('hidden');
    refs.modal.setAttribute('aria-hidden', 'false');
    lockBackgroundScroll();

    // 🆕 Foca o scroll dentro da lista do ranking:
    const list = refs.modal.querySelector('.leaderboard-list');
    if (list) list.scrollTop = 0;
  
    if (!state.loaded) {
      fetchLeaderboard();
    } else {
      renderList();
      updateTimestamp();
    }
  }

  function closeModal() {
    if (!refs.modal) return;
    refs.modal.classList.add('hidden');
    refs.modal.setAttribute('aria-hidden', 'true');
    unlockBackgroundScroll();
  }

  function handleBackdropClick(event) {
    if (!refs.modal) return;
    if (event.target === refs.modal) {
      closeModal();
    }
  }

  function handleEscape(event) {
    if (event.key !== 'Escape') return;
    if (refs.modal && !refs.modal.classList.contains('hidden')) {
      closeModal();
    }
  }

  function handleTabClick(event) {
    const mode = event.currentTarget?.dataset?.mode;
    if (!mode || mode === state.selected) return;
    setSelectedMode(mode);
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
    refs.modal.addEventListener('wheel', preventBackgroundScroll, { passive: false });
    refs.modal.addEventListener('touchmove', preventBackgroundScroll, { passive: false });
    document.addEventListener('keydown', handleEscape);
    refs.tabs.forEach((tab) => tab.addEventListener('click', handleTabClick));
    setupListIsolation();
    setSelectedMode(state.selected);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
