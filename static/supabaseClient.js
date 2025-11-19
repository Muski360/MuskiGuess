;(function (window) {
  const utils = window.muskiUtils;
  if (!utils) {
    throw new Error('utils.js precisa ser carregado antes de supabaseClient.js');
  }

  function readMeta(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el?.content || null;
  }

  function resolveConfig() {
    const candidates = [
      window.__SUPABASE_CONFIG__,
      window.__MUSKIGUESS_SUPABASE__,
      window.supabaseConfig,
      {
        url: window.SUPABASE_URL,
        anonKey: window.SUPABASE_ANON_KEY,
      },
      {
        url: readMeta('supabase-url'),
        anonKey: readMeta('supabase-anon-key'),
      },
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const url = candidate.url || candidate.supabaseUrl || candidate.projectUrl;
      const anonKey = candidate.anonKey || candidate.key || candidate.anon_key;
      if (url && anonKey) return { url, anonKey };
    }
    throw new Error('Configurações do Supabase não encontradas. Defina url e anonKey.');
  }

  let client = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Biblioteca supabase-js v2 não encontrada. Inclua o script CDN antes.');
    }
    const { url, anonKey } = resolveConfig();
    client = window.supabase.createClient(url, anonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    });
    return client;
  }

  function isSessionMissingError(error) {
    if (!error) return false;
    const message = String(error.message || error.error_description || '').toLowerCase();
    return (
      error.name === 'AuthSessionMissingError' ||
      message.includes('session missing') ||
      message.includes('auth session missing')
    );
  }

  async function getSession() {
    try {
      const { data, error } = await getClient().auth.getSession();
      if (error) {
        if (isSessionMissingError(error)) return null;
        throw error;
      }
      return data?.session || null;
    } catch (error) {
      if (isSessionMissingError(error)) return null;
      throw error;
    }
  }

  async function getUser() {
    try {
      const { data, error } = await getClient().auth.getUser();
      if (error) {
        if (isSessionMissingError(error)) return null;
        throw error;
      }
      return data?.user || null;
    } catch (error) {
      if (isSessionMissingError(error)) return null;
      throw error;
    }
  }

  function onAuthStateChange(callback) {
    if (typeof callback !== 'function') return () => {};
    const { data } = getClient().auth.onAuthStateChange((event, session) => {
      callback(session?.user || null, event);
    });
    return () => data?.subscription?.unsubscribe();
  }

  window.supabaseClient = {
    getClient,
    getSession,
    getUser,
    onAuthStateChange,
  };

  utils.testLog('supabaseClient');
})(window);
