;(function (window) {
  const htmlDecoder = document.createElement('textarea');

  function decodeHtml(value = '') {
    htmlDecoder.innerHTML = value;
    return htmlDecoder.value;
  }

  function normalizeError(err, fallback = 'Algo deu errado.') {
    if (!err) return fallback;
    if (typeof err === 'string') return err;
    if (err?.message) return err.message;
    if (err?.error_description) return err.error_description;
    if (err?.error) return err.error;
    return fallback;
  }

  function safeNumber(value, defaultValue = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  function clampExperience(exp) {
    return Math.max(0, safeNumber(exp, 0));
  }

  function levelFromExperience(exp, xpPerLevel = 100) {
    const normalized = clampExperience(exp);
    return Math.max(1, Math.floor(normalized / xpPerLevel) + 1);
  }

  function publicProfile(payload = {}) {
    return {
      username: (payload.username || '').trim(),
      level: safeNumber(payload.level, 1),
      experience: clampExperience(payload.experience),
      tag: payload.tag || null,
    };
  }

  function testLog(label) {
    console.log(`[${label}] teste: ok`);
  }

  window.muskiUtils = {
    decodeHtml,
    normalizeError,
    safeNumber,
    clampExperience,
    levelFromExperience,
    publicProfile,
    testLog,
  };

  testLog('utils');
})(window);
