;(function (window) {
  const utils = window.muskiUtils;
  const supabaseClient = window.supabaseClient;
  const profiles = window.profiles;
  if (!utils || !supabaseClient || !profiles) {
    throw new Error('Carregue utils.js, supabaseClient.js e profiles.js antes de stats.js');
  }

  const MODES = ['classic', 'dupleto', 'quapleto', 'multiplayer', 'total'];
  const XP_REWARD = {
    win: 35,
    loss: 10,
    multiplayerBonusWin: 15,
    multiplayerBonusLoss: 5,
  };

  function baseStats(mode) {
    return {
      mode,
      num_games: 0,
      num_wins: 0,
      num_multiplayer_games: mode === 'multiplayer' ? 0 : null,
      num_multiplayer_wins: mode === 'multiplayer' ? 0 : null,
    };
  }

  function mapStatsRow(row) {
    if (!row) return null;
    return {
      mode: row.mode,
      num_games: utils.safeNumber(row.num_games, 0),
      num_wins: utils.safeNumber(row.num_wins, 0),
      num_losses: utils.safeNumber(
        row.num_losses,
        utils.safeNumber(row.num_games, 0) - utils.safeNumber(row.num_wins, 0)
      ),
      num_multiplayer_games:
        row.mode === 'multiplayer' ? utils.safeNumber(row.num_multiplayer_games, 0) : null,
      num_multiplayer_wins:
        row.mode === 'multiplayer' ? utils.safeNumber(row.num_multiplayer_wins, 0) : null,
      num_multiplayer_losses:
        row.mode === 'multiplayer'
          ? utils.safeNumber(
              row.num_multiplayer_losses,
              utils.safeNumber(row.num_multiplayer_games, 0) -
                utils.safeNumber(row.num_multiplayer_wins, 0)
            )
          : null,
    };
  }

  async function ensureInitialStats(userId) {
    const supabase = supabaseClient.getClient();
    const rows = MODES.map((mode) => ({
      user_id: userId,
      ...baseStats(mode),
    }));
    const { error } = await supabase.from('stats').upsert(rows, {
      onConflict: 'user_id,mode',
      ignoreDuplicates: true,
    });
    if (error) throw error;
    utils.testLog('stats.ensureInitialStats');
    return getStats(userId);
  }

  async function getStats(userId) {
    if (!userId) return [];
    const supabase = supabaseClient.getClient();
    const { data, error } = await supabase
      .from('stats')
      .select(
        'mode, num_games, num_wins, num_losses, num_multiplayer_games, num_multiplayer_wins, num_multiplayer_losses'
      )
      .eq('user_id', userId);
    if (error) throw error;
    const mapped = Array.isArray(data) ? data.map(mapStatsRow).filter(Boolean) : [];
    utils.testLog('stats.getStats');
    return mapped;
  }

  async function getStatsRow(userId, mode) {
    const supabase = supabaseClient.getClient();
    const { data, error } = await supabase
      .from('stats')
      .select(
        'mode, num_games, num_wins, num_losses, num_multiplayer_games, num_multiplayer_wins, num_multiplayer_losses'
      )
      .eq('user_id', userId)
      .eq('mode', mode)
      .limit(1);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return mapStatsRow(row) || baseStats(mode);
  }

  async function saveStatsRow(userId, record) {
    const supabase = supabaseClient.getClient();
    const payload = {
      user_id: userId,
      mode: record.mode,
      num_games: record.num_games,
      num_wins: record.num_wins,
    };
    if (record.mode === 'multiplayer') {
      payload.num_multiplayer_games = record.num_multiplayer_games;
      payload.num_multiplayer_wins = record.num_multiplayer_wins;
    } else {
      payload.num_multiplayer_games = null;
      payload.num_multiplayer_wins = null;
    }
    const { data, error } = await supabase
      .from('stats')
      .upsert(payload, { onConflict: 'user_id,mode' })
      .select(
        'mode, num_games, num_wins, num_losses, num_multiplayer_games, num_multiplayer_wins, num_multiplayer_losses'
      )
      .single();
    if (error) throw error;
    return mapStatsRow(data);
  }

  function computeXpReward({ mode, won }) {
    let xp = won ? XP_REWARD.win : XP_REWARD.loss;
    if (mode === 'multiplayer') {
      xp += won ? XP_REWARD.multiplayerBonusWin : XP_REWARD.multiplayerBonusLoss;
    }
    return xp;
  }

  async function recordResult({ userId, mode, won }) {
    if (!userId || !mode) throw new Error('userId e mode são obrigatórios em recordResult');
    if (!MODES.includes(mode)) throw new Error(`Modo inválido: ${mode}`);
    await ensureInitialStats(userId);
    const current = await getStatsRow(userId, mode);
    const updated = {
      ...current,
      num_games: current.num_games + 1,
      num_wins: current.num_wins + (won ? 1 : 0),
    };
    if (mode === 'multiplayer') {
      updated.num_multiplayer_games = (current.num_multiplayer_games || 0) + 1;
      updated.num_multiplayer_wins = (current.num_multiplayer_wins || 0) + (won ? 1 : 0);
    } else {
      updated.num_multiplayer_games = null;
      updated.num_multiplayer_wins = null;
      updated.num_multiplayer_losses = null;
    }
    updated.num_losses = Math.max(0, updated.num_games - updated.num_wins);
    const saved = await saveStatsRow(userId, updated);

    // Atualiza o total agregado.
    const total = await getStatsRow(userId, 'total');
    const totalUpdated = {
      ...total,
      num_games: total.num_games + 1,
      num_wins: total.num_wins + (won ? 1 : 0),
      num_multiplayer_games: null,
      num_multiplayer_wins: null,
      num_multiplayer_losses: null,
    };
    totalUpdated.num_losses = Math.max(0, totalUpdated.num_games - totalUpdated.num_wins);
    await saveStatsRow(userId, totalUpdated);

    // XP & nível.
    const xpGain = computeXpReward({ mode, won });
    await profiles.incrementExperience(userId, xpGain);

    utils.testLog('stats.recordResult');
    return { mode: saved, total: totalUpdated, xpEarned: xpGain };
  }

  window.statsApi = {
    MODES,
    ensureInitialStats,
    getStats,
    recordResult,
    getStatsRow,
  };

  utils.testLog('stats');
})(window);
