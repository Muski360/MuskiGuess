;(function (window) {
  const utils = window.muskiUtils;
  if (!utils) {
    throw new Error('utils.js precisa ser carregado antes de wordService.js');
  }

  const WORD_FILES = {
    pt: 'data/words_pt.json',
    en: 'data/words_en.json',
  };

  const cache = {};
  const pending = {};

  function sanitizeLang(lang) {
    const normalized = (lang || 'pt').toLowerCase();
    return WORD_FILES[normalized] ? normalized : 'pt';
  }

  function normalizeWord(value = '') {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '');
  }

  async function loadDictionary(lang) {
    const safeLang = sanitizeLang(lang);
    if (cache[safeLang]) return cache[safeLang];
    if (!pending[safeLang]) {
      const url = WORD_FILES[safeLang];
      pending[safeLang] = fetch(url, { cache: 'force-cache' })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Falha ao carregar lista de palavras (${safeLang})`);
          }
          return response.json();
        })
        .then((rawList) => {
          const normalized = Array.isArray(rawList)
            ? rawList
                .map((word) => normalizeWord(word))
                .filter((word) => word.length === 5)
            : [];
          const deduped = Array.from(new Set(normalized));
          const payload = {
            lang: safeLang,
            words: deduped,
            wordSet: new Set(deduped),
          };
          cache[safeLang] = payload;
          return payload;
        })
        .catch((error) => {
          console.error('[wordService] Erro carregando dicionário', error);
          throw error;
        });
    }
    return pending[safeLang];
  }

  async function isValidWord(word, lang) {
    const normalized = normalizeWord(word);
    if (normalized.length !== 5) return false;
    const dict = await loadDictionary(lang);
    return dict.wordSet.has(normalized);
  }

  function randomSample(list, count) {
    if (!Array.isArray(list) || list.length === 0) return [];
    if (count >= list.length) {
      const clone = list.slice();
      for (let i = clone.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [clone[i], clone[j]] = [clone[j], clone[i]];
      }
      return clone.slice(0, count);
    }
    const selected = new Set();
    while (selected.size < count) {
      const index = Math.floor(Math.random() * list.length);
      selected.add(list[index]);
    }
    return Array.from(selected);
  }

  async function getRandomWords(lang, count = 1) {
    const dict = await loadDictionary(lang);
    const picks = randomSample(dict.words, Math.max(1, count));
    return picks;
  }

  function evaluateSingle(guess, solution, displayLetters) {
    const feedback = new Array(5);
    const counts = {};
    for (let i = 0; i < 5; i += 1) {
      const solChar = solution[i];
      if (guess[i] === solChar) {
        feedback[i] = { letter: displayLetters[i], status: 'green' };
      } else {
        counts[solChar] = (counts[solChar] || 0) + 1;
        feedback[i] = null;
      }
    }
    for (let i = 0; i < 5; i += 1) {
      if (feedback[i]) continue;
      const guessChar = guess[i];
      if (counts[guessChar] > 0) {
        feedback[i] = { letter: displayLetters[i], status: 'yellow' };
        counts[guessChar] -= 1;
      } else {
        feedback[i] = { letter: displayLetters[i], status: 'gray' };
      }
    }
    return feedback;
  }

  function evaluateGuess(guessInput, solutions) {
    const normalizedGuess = normalizeWord(guessInput);
    if (normalizedGuess.length !== 5) {
      throw new Error('Palpite inválido: é necessário 5 letras.');
    }
    const letters = (guessInput || '')
      .toUpperCase()
      .padEnd(5)
      .slice(0, 5)
      .split('');
    const targets = Array.isArray(solutions) ? solutions : [];
    return targets.map((solution) => evaluateSingle(normalizedGuess, solution, letters));
  }

  window.wordService = {
    normalizeWord,
    isValidWord,
    getRandomWords,
    evaluateGuess,
    async getRandomWord(lang) {
      const [word] = await getRandomWords(lang, 1);
      return word || null;
    },
  };

  utils.testLog('wordService');
})(window);
