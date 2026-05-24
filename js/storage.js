const KEY = 'cubequest3d.save.v1';

const defaults = () => ({
  bestScore: 0,
  bestPerLevel: {},
  starsPerLevel: {},
  levelsCleared: 0,
  highScores: [],
  muted: false,
});

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = { ...defaults(), ...JSON.parse(raw) };
    } else {
      cache = defaults();
    }
  } catch {
    cache = defaults();
  }
  return cache;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch { /* ignore quota */ }
}

export const Storage = {
  get() { return load(); },

  setMuted(m) {
    load(); cache.muted = !!m; save();
  },

  recordRun({ levelIndex, score, time, deaths, stars }) {
    load();
    cache.bestScore = Math.max(cache.bestScore, score);
    const prev = cache.bestPerLevel[levelIndex] || { score: 0, time: Infinity };
    if (score > prev.score || time < prev.time) {
      cache.bestPerLevel[levelIndex] = {
        score: Math.max(prev.score, score),
        time: Math.min(prev.time === Infinity ? time : prev.time, time),
      };
    }
    cache.starsPerLevel[levelIndex] = Math.max(cache.starsPerLevel[levelIndex] || 0, stars);
    cache.highScores.push({ score, time, levelIndex, date: Date.now() });
    cache.highScores.sort((a, b) => b.score - a.score);
    cache.highScores = cache.highScores.slice(0, 10);
    save();
  },

  recordLevelComplete(levelIndex) {
    load();
    cache.levelsCleared = Math.max(cache.levelsCleared, levelIndex + 1);
    save();
  },

  reset() {
    cache = defaults();
    save();
  },
};
