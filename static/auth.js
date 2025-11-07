;(function () {
  const MODE_LABELS = {
    classic: 'Clássico',
    dupleto: 'Dupleto',
    quapleto: 'Quapleto',
    multiplayer: 'Multiplayer',
    total: 'Total',
  };

  const state = {
    user: null,
    stats: [],
    statsLoaded: false,
    statsLoading: false,
    listeners: [],
  };

  const refs = {
    controlsContainer: null,
    loginModal: null,
    registerModal: null,
    statsModal: null,
    loginForm: null,
    registerForm: null,
    statsBody: null,
    statsStatus: null,
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function notifyListeners() {
    const snapshot = {
      user: state.user,
      stats: state.stats,
      statsLoaded: state.statsLoaded,
    };
    state.listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (err) {
        console.warn('Auth listener error', err);
      }
    });
  }

  function setUser(user) {
    state.user = user;
    if (!user) {
      state.stats = [];
      state.statsLoaded = false;
    }
    renderControls();
    notifyListeners();
  }

  function ensureModals() {
    if (document.getElementById('loginModal')) {
      refs.loginModal = document.getElementById('loginModal');
      refs.registerModal = document.getElementById('registerModal');
      refs.statsModal = document.getElementById('statsModal');
      refs.loginForm = document.getElementById('loginForm');
      refs.registerForm = document.getElementById('registerForm');
      refs.statsBody = document.getElementById('statsTableBody');
      refs.statsStatus = document.getElementById('statsStatus');
      return;
    }
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="auth-modal hidden" id="loginModal" role="dialog" aria-modal="true" aria-labelledby="loginTitle">
        <div class="auth-modal-card">
          <button type="button" class="auth-modal-close" data-auth-close>&times;</button>
          <h2 id="loginTitle">Entrar</h2>
          <form id="loginForm" class="auth-form">
            <label>
              <span>E-mail</span>
              <input type="email" name="email" required autocomplete="email" />
            </label>
            <label>
              <span>Senha</span>
              <input type="password" name="password" required minlength="8" autocomplete="current-password" />
            </label>
            <p class="auth-error" id="loginError"></p>
            <button type="submit" class="auth-primary-btn">Entrar</button>
          </form>
        </div>
      </div>

      <div class="auth-modal hidden" id="registerModal" role="dialog" aria-modal="true" aria-labelledby="registerTitle">
        <div class="auth-modal-card">
          <button type="button" class="auth-modal-close" data-auth-close>&times;</button>
          <h2 id="registerTitle">Criar conta</h2>
          <form id="registerForm" class="auth-form">
            <label>
              <span>Usuário</span>
              <input type="text" name="username" required minlength="1" maxlength="12" pattern="[A-Za-z0-9]{1,12}" autocomplete="nickname" />
            </label>
            <label>
              <span>E-mail</span>
              <input type="email" name="email" required autocomplete="email" />
            </label>
            <label>
              <span>Senha</span>
              <input type="password" name="password" required minlength="8" autocomplete="new-password" />
            </label>
            <label>
              <span>Confirmar senha</span>
              <input type="password" name="confirmPassword" required minlength="8" autocomplete="new-password" />
            </label>
            <p class="auth-error" id="registerError"></p>
            <button type="submit" class="auth-primary-btn">Cadastrar</button>
          </form>
        </div>
      </div>

      <div class="auth-modal hidden" id="statsModal" role="dialog" aria-modal="true" aria-labelledby="statsTitle">
        <div class="auth-modal-card auth-modal-wide">
          <button type="button" class="auth-modal-close" data-auth-close>&times;</button>
          <h2 id="statsTitle">Suas estatísticas</h2>
          <div class="auth-status" id="statsStatus"></div>
          <div class="stats-table-wrapper">
            <table class="stats-table">
              <thead>
                <tr>
                  <th>Modo</th>
                  <th>Jogos</th>
                  <th>Vitórias</th>
                  <th>Derrotas</th>
                  <th>Multiplayer Jogos</th>
                  <th>Multiplayer Vitórias</th>
                  <th>Multiplayer Derrotas</th>
                </tr>
              </thead>
              <tbody id="statsTableBody"></tbody>
            </table>
          </div>
          <button type="button" class="auth-secondary-btn" data-auth-close>Fechar</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper);
    ensureModals();

    [refs.loginModal, refs.registerModal, refs.statsModal].forEach((modal) => {
      if (!modal) return;
      modal.addEventListener('click', (event) => {
        if (event.target === modal || event.target?.dataset?.authClose !== undefined) {
          closeModal(modal);
        }
      });
    });
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
    const input = modal.querySelector('input');
    if (input) {
      setTimeout(() => input.focus(), 50);
    }
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
    const errorEl = modal.querySelector('.auth-error');
    if (errorEl) errorEl.textContent = '';
    const form = modal.querySelector('form');
    if (form) {
      setLoading(form, false);
    }
  }

  function setLoading(form, value) {
    const submitBtn = form?.querySelector('button[type="submit"]');
    if (!submitBtn) return;
    submitBtn.disabled = !!value;
    submitBtn.classList.toggle('loading', !!value);
  }

  async function fetchJSON(url, options) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = document.getElementById('loginError');
    if (errorEl) errorEl.textContent = '';
    const formData = new FormData(form);
    const email = formData.get('email');
    const password = formData.get('password');
    setLoading(form, true);
    try {
      const { ok, data } = await fetchJSON('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!ok) {
        const message = data?.error || 'Não foi possível entrar.';
        if (errorEl) errorEl.textContent = message;
        return;
      }
      closeModal(refs.loginModal);
      setUser(data.user || null);
      await refreshStats(true);
    } catch (err) {
      if (errorEl) errorEl.textContent = 'Erro de conexão. Tente novamente.';
    } finally {
      setLoading(form, false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = document.getElementById('registerError');
    if (errorEl) errorEl.textContent = '';
    const formData = new FormData(form);
    const payload = {
      username: formData.get('username'),
      email: formData.get('email'),
      password: formData.get('password'),
    };
    const confirmPassword = formData.get('confirmPassword');
    if (String(payload.password || '') !== String(confirmPassword || '')) {
      if (errorEl) errorEl.textContent = 'As senhas não conferem.';
      return;
    }
    setLoading(form, true);
    try {
      const { ok, data, status } = await fetchJSON('/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!ok) {
        let message = 'Não foi possível cadastrar.';
        if (status === 409) {
          message = data?.errors?.email || 'E-mail já cadastrado.';
        } else if (data?.errors) {
          message = Object.values(data.errors)[0] || message;
        } else if (data?.error) {
          message = data.error;
        }
        if (errorEl) errorEl.textContent = message;
        return;
      }
      closeModal(refs.registerModal);
      setUser(data.user || null);
      await refreshStats(true);
    } catch (err) {
      if (errorEl) errorEl.textContent = 'Erro de conexão. Tente novamente.';
    } finally {
      setLoading(form, false);
    }
  }

  async function handleLogout() {
    try {
      await fetchJSON('/logout', { method: 'POST', body: JSON.stringify({}) });
    } catch (err) {
      console.warn('Falha ao encerrar sessão', err);
    }
    setUser(null);
  }

  function renderControls() {
    if (!refs.controlsContainer) {
      refs.controlsContainer = document.getElementById('authControls');
    }
    const container = refs.controlsContainer;
    if (!container) return;
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    if (!state.user) {
      const loginBtn = document.createElement('button');
      loginBtn.type = 'button';
      loginBtn.className = 'auth-btn';
      loginBtn.textContent = 'Entrar';
      loginBtn.addEventListener('click', () => openModal(refs.loginModal));

      const registerBtn = document.createElement('button');
      registerBtn.type = 'button';
      registerBtn.className = 'auth-btn auth-btn-secondary';
      registerBtn.textContent = 'Criar conta';
      registerBtn.addEventListener('click', () => openModal(refs.registerModal));

      fragment.appendChild(loginBtn);
      fragment.appendChild(registerBtn);
    } else {
      const welcome = document.createElement('span');
      welcome.className = 'auth-welcome';
      welcome.innerHTML = `Bem-vindo, <strong>${escapeHtml(state.user.username || '')}</strong>`;

      const statsBtn = document.createElement('button');
      statsBtn.type = 'button';
      statsBtn.className = 'auth-btn auth-btn-ghost';
      statsBtn.textContent = 'Estatísticas';
      statsBtn.addEventListener('click', () => openStatsModal());

      const logoutBtn = document.createElement('button');
      logoutBtn.type = 'button';
      logoutBtn.className = 'auth-btn auth-btn-link';
      logoutBtn.textContent = 'Sair';
      logoutBtn.addEventListener('click', handleLogout);

      fragment.appendChild(welcome);
      fragment.appendChild(statsBtn);
      fragment.appendChild(logoutBtn);
    }
    container.appendChild(fragment);
  }

  function renderStatsTable() {
    if (!refs.statsBody) return;
    refs.statsBody.innerHTML = '';
    if (!Array.isArray(state.stats) || state.stats.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7;
      cell.textContent = 'Nenhuma estatística disponível.';
      row.appendChild(cell);
      refs.statsBody.appendChild(row);
      return;
    }
    state.stats.forEach((entry) => {
      const row = document.createElement('tr');
      const losses = entry?.num_losses ?? Math.max((entry?.num_games || 0) - (entry?.num_wins || 0), 0);
      const mpGames = entry?.num_multiplayer_games;
      const mpWins = entry?.num_multiplayer_wins;
      const mpLosses =
        entry?.num_multiplayer_losses ??
        Math.max((entry?.num_multiplayer_games || 0) - (entry?.num_multiplayer_wins || 0), 0);

      const cells = [
        { label: 'Modo', value: escapeHtml(MODE_LABELS[entry.mode] || entry.mode || '') },
        { label: 'Jogos', value: entry?.num_games ?? 0 },
        { label: 'Vitórias', value: entry?.num_wins ?? 0 },
        { label: 'Derrotas', value: losses },
        { label: 'Multiplayer Jogos', value: mpGames != null ? mpGames : '—' },
        { label: 'Multiplayer Vitórias', value: mpWins != null ? mpWins : '—' },
        { label: 'Multiplayer Derrotas', value: mpLosses != null ? mpLosses : '—' },
      ];

      cells.forEach((cell) => {
        const td = document.createElement('td');
        td.dataset.label = cell.label;
        td.textContent = cell.value;
        row.appendChild(td);
      });

      refs.statsBody.appendChild(row);
    });
  }

  async function refreshStats(force = false) {
    if (!state.user) {
      state.stats = [];
      state.statsLoaded = false;
      renderStatsTable();
      return [];
    }
    if (state.statsLoading) return state.stats;
    if (state.statsLoaded && !force) return state.stats;
    state.statsLoading = true;
    if (refs.statsStatus) {
      refs.statsStatus.textContent = 'Carregando estatísticas...';
      refs.statsStatus.classList.remove('error');
    }
    try {
      const { ok, data } = await fetchJSON('/api/stats', { method: 'GET' });
      if (!ok) {
        if (refs.statsStatus) {
          refs.statsStatus.textContent = data?.error || 'Não foi possível carregar as estatísticas.';
          refs.statsStatus.classList.add('error');
        }
        return state.stats;
      }
      state.stats = Array.isArray(data?.stats) ? data.stats : [];
      state.statsLoaded = true;
      if (refs.statsStatus) {
        refs.statsStatus.textContent = '';
      }
      renderStatsTable();
      notifyListeners();
    } catch (err) {
      if (refs.statsStatus) {
        refs.statsStatus.textContent = 'Erro de conexão ao carregar as estatísticas.';
        refs.statsStatus.classList.add('error');
      }
    } finally {
      state.statsLoading = false;
    }
    return state.stats;
  }

  async function openStatsModal() {
    if (!state.user) {
      openModal(refs.loginModal);
      return;
    }
    openModal(refs.statsModal);
    await refreshStats(true);
  }

  async function fetchCurrentUser() {
    try {
      const { ok, data } = await fetchJSON('/api/me', { method: 'GET' });
      if (!ok) {
        setUser(null);
        return null;
      }
      setUser(data?.user || null);
      if (data?.user) {
        await refreshStats(true);
      }
      return data?.user || null;
    } catch (err) {
      setUser(null);
      return null;
    }
  }

  function handleGlobalKeydown(event) {
    if (event.key !== 'Escape') return;
    [refs.loginModal, refs.registerModal, refs.statsModal].forEach((modal) => {
      if (modal && !modal.classList.contains('hidden')) {
        closeModal(modal);
      }
    });
  }

  function init() {
    ensureModals();
    renderControls();
    if (refs.loginForm) {
      refs.loginForm.addEventListener('submit', handleLogin);
    }
    if (refs.registerForm) {
      refs.registerForm.addEventListener('submit', handleRegister);
    }
    document.addEventListener('keydown', handleGlobalKeydown);
    fetchCurrentUser();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.auth = {
    getUser() {
      return state.user;
    },
    isLoggedIn() {
      return !!state.user;
    },
    refreshStats,
    openLogin() {
      openModal(refs.loginModal);
    },
    openRegister() {
      openModal(refs.registerModal);
    },
    openStats() {
      openStatsModal();
    },
    onAuthChange(callback) {
      if (typeof callback === 'function') {
        state.listeners.push(callback);
      }
      return () => {
        state.listeners = state.listeners.filter((fn) => fn !== callback);
      };
    },
  };
})();
