;(function (window) {
  const utils = window.muskiUtils;
  const supabaseClient = window.supabaseClient;
  const profiles = window.profiles;
  const statsApi = window.statsApi;
  if (!utils || !supabaseClient || !profiles || !statsApi) {
    throw new Error('Carregue utils, supabaseClient, profiles e stats antes de auth.js');
  }

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
    profileMenu: null,
  };

  const MODE_LABELS = {
    classic: utils.decodeHtml('Cl&aacute;ssico'),
    dupleto: 'Dupleto',
    quapleto: 'Quapleto',
    multiplayer: 'Multiplayer',
    total: 'Total',
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getUserInitial(user) {
    const source = (user?.username || user?.email || '').trim();
    return source ? source.charAt(0).toUpperCase() : '?';
  }

  function mapAuthUser(user, profile) {
    if (!user || !profile) return null;
    return {
      id: user.id,
      email: user.email || '',
      username: profile.username,
      level: profile.level,
      experience: profile.experience,
      tag: profile.tag,
    };
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

  function openModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  function closeAllModals() {
    [refs.loginModal, refs.registerModal, refs.statsModal].forEach(closeModal);
  }

  function renderStatsTable() {
    if (!refs.statsBody) return;
    refs.statsBody.innerHTML = '';
    if (!state.stats.length) {
      refs.statsBody.innerHTML = `
        <tr>
          <td colspan="4" class="empty">Nenhuma partida ainda.</td>
        </tr>
      `;
      return;
    }
    state.stats.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${MODE_LABELS[row.mode] || row.mode}</td>
        <td>${row.num_games}</td>
        <td>${row.num_wins}</td>
        <td>${row.num_losses}</td>
      `;
      refs.statsBody.appendChild(tr);
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
      await statsApi.ensureInitialStats(state.user.id);
      const data = await statsApi.getStats(state.user.id);
      state.stats = data;
      state.statsLoaded = true;
      renderStatsTable();
      if (refs.statsStatus) refs.statsStatus.textContent = '';
      utils.testLog('auth.refreshStats');
    } catch (err) {
      const message = utils.normalizeError(err, 'Erro ao carregar estatísticas.');
      if (refs.statsStatus) {
        refs.statsStatus.textContent = message;
        refs.statsStatus.classList.add('error');
      }
      console.error(message, err);
    } finally {
      state.statsLoading = false;
      notifyListeners();
    }
    return state.stats;
  }

  async function hydrateUser(user) {
    if (!user) {
      state.user = null;
      state.stats = [];
      state.statsLoaded = false;
      renderControls();
      renderStatsTable();
      notifyListeners();
      protectRestrictedElements();
      return null;
    }
    const profile = await profiles.ensureProfile(user, {
      username: profiles.deriveUsernameFromEmail(user.email),
    });
    await statsApi.ensureInitialStats(user.id);
    const publicUser = mapAuthUser(user, profile);
    state.user = publicUser;
    renderControls();
    await refreshStats(true);
    notifyListeners();
    protectRestrictedElements();
    utils.testLog('auth.hydrateUser');
    return publicUser;
  }

  function handleProfileMenu(isOpen) {
    if (!refs.profileMenu) return;
    const trigger = refs.profileMenu.querySelector('[data-profile-trigger]');
    refs.profileMenu.classList.toggle('open', isOpen);
    if (trigger) trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  function renderControls() {
    if (!refs.controlsContainer) return;
    refs.controlsContainer.innerHTML = '';
    if (!state.user) {
      const loginBtn = document.createElement('button');
      loginBtn.type = 'button';
      loginBtn.className = 'auth-cta-btn ghost';
      loginBtn.textContent = 'Entrar';
      loginBtn.addEventListener('click', () => openModal(refs.loginModal));

      const registerBtn = document.createElement('button');
      registerBtn.type = 'button';
      registerBtn.className = 'auth-cta-btn primary';
      registerBtn.textContent = 'Criar conta';
      registerBtn.addEventListener('click', () => openModal(refs.registerModal));

      refs.controlsContainer.appendChild(loginBtn);
      refs.controlsContainer.appendChild(registerBtn);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'profile-menu';
    wrapper.innerHTML = `
      <button class="profile-trigger" data-profile-trigger aria-expanded="false" aria-haspopup="true">
        <span class="profile-initial">${escapeHtml(getUserInitial(state.user))}</span>
        <span class="profile-name">${escapeHtml(state.user.username || 'Jogador')}</span>
      </button>
      <div class="profile-dropdown">
        <div class="profile-row">
          <p class="profile-username">${escapeHtml(state.user.username || '')}</p>
          <p class="profile-tag">${escapeHtml(state.user.tag || '')}</p>
        </div>
        <p class="profile-level">Nível ${state.user.level} · ${state.user.experience} XP</p>
        <button type="button" class="profile-action" data-profile-stats>Minhas estatísticas</button>
        <button type="button" class="profile-action danger" data-profile-logout>Sair</button>
      </div>
    `;
    refs.controlsContainer.appendChild(wrapper);
    refs.profileMenu = wrapper;

    const trigger = wrapper.querySelector('[data-profile-trigger]');
    trigger?.addEventListener('click', (event) => {
      event.preventDefault();
      const isOpen = wrapper.classList.contains('open');
      handleProfileMenu(!isOpen);
    });

    wrapper.querySelector('[data-profile-stats]')?.addEventListener('click', () => {
      openStatsModal();
    });

    wrapper.querySelector('[data-profile-logout]')?.addEventListener('click', () => {
      logout();
    });
  }

  async function handleLogin(event) {
    event?.preventDefault();
    const form = refs.loginForm;
    if (!form) return;
    const email = form.email.value.trim();
    const password = form.password.value.trim();
    const errorEl = form.querySelector('.auth-error');
    if (errorEl) errorEl.textContent = '';
    try {
      const { data, error } = await supabaseClient.getClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      await hydrateUser(data.user);
      closeModal(refs.loginModal);
      utils.testLog('auth.login');
    } catch (err) {
      const message = utils.normalizeError(err, 'Não foi possível entrar.');
      if (errorEl) errorEl.textContent = message;
    }
  }

  async function handleRegister(event) {
    event?.preventDefault();
    const form = refs.registerForm;
    if (!form) return;
    const email = form.email.value.trim();
    const password = form.password.value.trim();
    const username = form.username.value.trim();
    const tag = form.tag.value.trim();
    const errorEl = form.querySelector('.auth-error');
    if (errorEl) errorEl.textContent = '';
    try {
      const { data, error } = await supabaseClient.getClient().auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error('Cadastro realizado, finalize a confirmação pelo e-mail.');
      await profiles.ensureProfile(user, { username, tag });
      await statsApi.ensureInitialStats(user.id);
      await hydrateUser(user);
      closeModal(refs.registerModal);
      utils.testLog('auth.register');
    } catch (err) {
      const message = utils.normalizeError(err, 'Não foi possível criar sua conta.');
      if (errorEl) errorEl.textContent = message;
    }
  }

  async function logout() {
    try {
      await supabaseClient.getClient().auth.signOut();
    } catch (err) {
      console.warn('Erro ao sair', err);
    } finally {
      state.user = null;
      state.stats = [];
      state.statsLoaded = false;
      renderControls();
      closeAllModals();
      notifyListeners();
      utils.testLog('auth.logout');
    }
  }

  function renderStatsModalSkeleton() {
    if (!refs.statsModal) return;
    if (refs.statsStatus) {
      refs.statsStatus.textContent = '';
      refs.statsStatus.classList.remove('error');
    }
    renderStatsTable();
  }

  async function openStatsModal() {
    if (!state.user) {
      openModal(refs.loginModal);
      return;
    }
    renderStatsModalSkeleton();
    openModal(refs.statsModal);
    await refreshStats(true);
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
              <input type="password" name="password" required autocomplete="current-password" />
            </label>
            <p class="auth-error" id="loginError"></p>
            <button type="submit" class="auth-submit">Entrar</button>
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
              <input type="text" name="username" maxlength="12" required autocomplete="username" />
            </label>
            <label>
              <span>E-mail</span>
              <input type="email" name="email" required autocomplete="email" />
            </label>
            <label>
              <span>Senha</span>
              <input type="password" name="password" minlength="6" required autocomplete="new-password" />
            </label>
            <label>
              <span>Tag (opcional)</span>
              <input type="text" name="tag" maxlength="32" autocomplete="off" />
            </label>
            <p class="auth-error" id="registerError"></p>
            <button type="submit" class="auth-submit primary">Criar conta</button>
          </form>
        </div>
      </div>
      <div class="auth-modal hidden" id="statsModal" role="dialog" aria-modal="true" aria-labelledby="statsTitle">
        <div class="auth-modal-card">
          <button type="button" class="auth-modal-close" data-auth-close>&times;</button>
          <div class="stats-header">
            <div>
              <p class="stats-eyebrow">Painel geral</p>
              <h2 id="statsTitle">Suas estatísticas</h2>
            </div>
            <p class="stats-status" id="statsStatus"></p>
          </div>
          <div class="stats-table">
            <table>
              <thead>
                <tr>
                  <th>Modo</th>
                  <th>Jogos</th>
                  <th>Vitórias</th>
                  <th>Derrotas</th>
                </tr>
              </thead>
              <tbody id="statsTableBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper);
    refs.loginModal = document.getElementById('loginModal');
    refs.registerModal = document.getElementById('registerModal');
    refs.statsModal = document.getElementById('statsModal');
    refs.loginForm = document.getElementById('loginForm');
    refs.registerForm = document.getElementById('registerForm');
    refs.statsBody = document.getElementById('statsTableBody');
    refs.statsStatus = document.getElementById('statsStatus');
  }

  function bindModalEvents() {
    [refs.loginModal, refs.registerModal, refs.statsModal].forEach((modal) => {
      if (!modal) return;
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          closeModal(modal);
        }
      });
      modal.querySelectorAll('[data-auth-close]').forEach((btn) =>
        btn.addEventListener('click', () => closeModal(modal))
      );
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeAllModals();
    });
  }

  function bindForms() {
    if (refs.loginForm) {
      refs.loginForm.addEventListener('submit', handleLogin);
    }
    if (refs.registerForm) {
      refs.registerForm.addEventListener('submit', handleRegister);
    }
  }

  function bindOutsideClick() {
    document.addEventListener('click', (event) => {
      if (!refs.profileMenu) return;
      if (refs.profileMenu.contains(event.target)) return;
      handleProfileMenu(false);
    });
  }

  async function bootstrapSession() {
    try {
      const user = await supabaseClient.getUser();
      if (user) {
        await hydrateUser(user);
      } else {
        hydrateUser(null);
      }
    } catch (err) {
      console.warn('Falha ao restaurar sessão', err);
      hydrateUser(null);
    }
  }

  function protectRestrictedElements() {
    const elements = document.querySelectorAll('[data-requires-auth]');
    elements.forEach((el) => {
      el.classList.toggle('hidden', !state.user);
    });
  }

  function onAuthStateChange() {
    supabaseClient.onAuthStateChange((user) => {
      hydrateUser(user);
      protectRestrictedElements();
    });
  }

  function init() {
    refs.controlsContainer = document.getElementById('authControls');
    ensureModals();
    bindModalEvents();
    bindForms();
    bindOutsideClick();
    renderControls();
    bootstrapSession();
    onAuthStateChange();
    utils.testLog('auth.init');
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
    logout,
  };
})(window);
