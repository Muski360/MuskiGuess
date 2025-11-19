;(function (window) {
  const utils = window.muskiUtils;
  const supabaseClient = window.supabaseClient;
  if (!utils || !supabaseClient) {
    throw new Error('utils.js e supabaseClient.js precisam ser carregados antes de profiles.js');
  }

  const XP_PER_LEVEL = 100;

  function sanitizeUsername(raw, fallback = 'player') {
    const cleaned = (raw || '')
      .trim()
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 12);
    if (cleaned) return cleaned;
    return `${fallback}${Math.floor(Math.random() * 9000 + 1000)}`;
  }

  function deriveUsernameFromEmail(email) {
    if (!email) return sanitizeUsername('');
    const local = email.split('@')[0] || '';
    return sanitizeUsername(local, 'muski');
  }

  function mapProfile(row) {
    return utils.publicProfile(row || {});
  }

  async function fetchProfile(userId) {
    if (!userId) return null;
    const supabase = supabaseClient.getClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('username, level, experience, tag')
      .eq('id', userId)
      .limit(1);

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const profile = mapProfile(row);
    utils.testLog('profiles.fetchProfile');
    return profile;
  }

  async function createProfile({ userId, username, tag }) {
    if (!userId) throw new Error('userId é obrigatório para criar profile');
    const supabase = supabaseClient.getClient();
    let attempts = 0;
    let lastError = null;
    let finalProfile = null;
    while (attempts < 3 && !finalProfile) {
      const candidateUsername = sanitizeUsername(username, 'muski');
      const payload = {
        id: userId,
        username: candidateUsername,
        tag: tag || null,
      };
      const { data, error } = await supabase
        .from('profiles')
        .insert(payload)
        .select('username, level, experience, tag')
        .single();

      if (!error) {
        finalProfile = mapProfile(data);
        break;
      }

      lastError = error;
      // Se username já existe, tenta outro.
      if (String(error?.message || '').toLowerCase().includes('duplicate')) {
        username = `${candidateUsername}${Math.floor(Math.random() * 90 + 10)}`;
      } else {
        break;
      }
      attempts += 1;
    }

    if (!finalProfile) {
      throw lastError || new Error('Não foi possível criar o perfil.');
    }
    utils.testLog('profiles.createProfile');
    return finalProfile;
  }

  async function ensureProfile(user, options = {}) {
    const userId = typeof user === 'string' ? user : user?.id;
    if (!userId) return null;
    const existing = await fetchProfile(userId);
    if (existing) return existing;
    const username =
      options.username || (typeof user === 'object' ? deriveUsernameFromEmail(user.email) : null);
    const created = await createProfile({
      userId,
      username,
      tag: options.tag,
    });
    utils.testLog('profiles.ensureProfile');
    return created;
  }

  async function incrementExperience(userId, deltaXp) {
    const supabase = supabaseClient.getClient();
    const current = (await fetchProfile(userId)) || { experience: 0, level: 1 };
    const nextXp = utils.clampExperience(current.experience + (deltaXp || 0));
    const nextLevel = utils.levelFromExperience(nextXp, XP_PER_LEVEL);
    const { data, error } = await supabase
      .from('profiles')
      .update({ experience: nextXp, level: nextLevel })
      .eq('id', userId)
      .select('username, level, experience, tag')
      .single();

    if (error) throw error;
    utils.testLog('profiles.incrementExperience');
    return mapProfile(data);
  }

  async function getCurrentUserProfile() {
    const user = await supabaseClient.getUser();
    if (!user) return null;
    const profile = await ensureProfile(user);
    utils.testLog('profiles.getCurrentUserProfile');
    return { user, profile };
  }

  window.profiles = {
    fetchProfile,
    createProfile,
    ensureProfile,
    incrementExperience,
    getCurrentUserProfile,
    deriveUsernameFromEmail,
    XP_PER_LEVEL,
  };

  utils.testLog('profiles');
})(window);
