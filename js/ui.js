import { Storage } from './storage.js';
import { Audio } from './audio.js';
import { LEVELS } from './levels.js';

const $ = (id) => document.getElementById(id);

const POWERUP_LABEL = {
  shield: 'SHIELD',
  speed: 'SPEED',
  magnet: 'MAGNET',
  doubleJump: '2x JUMP',
};

const POWERUP_ICON = {
  shield: '◇',
  speed: '⚡',
  magnet: '○',
  doubleJump: '↑↑',
};

export class UI {
  constructor(handlers) {
    this.handlers = handlers; // { onMenuAction(action), ... }
    this._toastTimer = null;
    this.bindButtons();
    this.refreshMenu();
  }

  bindButtons() {
    document.querySelectorAll('button[data-action]').forEach((b) => {
      b.addEventListener('click', () => {
        Audio.click();
        const a = b.getAttribute('data-action');
        this.handlers.onAction?.(a);
      });
    });
  }

  refreshMenu() {
    const s = Storage.get();
    $('menu-best').textContent = String(s.bestScore);
    $('menu-cleared').textContent = String(s.levelsCleared);
  }

  showHUD(visible) { $('hud').classList.toggle('hidden', !visible); }

  showOverlay(id) {
    // Hide all overlays first
    ['menu', 'pause', 'gameover', 'levelcomplete', 'victory', 'info']
      .forEach((n) => $(n).classList.add('hidden'));
    if (id) $(id).classList.remove('hidden');
  }

  setObjective(text) { $('hud-objective').textContent = text; }

  updateHud({ level, score, coinsCollected, coinsTotal, time, hp, maxHp, powerups }) {
    $('hud-level').textContent = `${level}`;
    $('hud-score').textContent = String(score);
    $('hud-coins').textContent = `${coinsCollected} / ${coinsTotal}`;
    $('hud-time').textContent = time.toFixed(1);

    // Hearts
    const heartsEl = $('hud-hearts');
    if (heartsEl.children.length !== maxHp) {
      heartsEl.innerHTML = '';
      for (let i = 0; i < maxHp; i++) {
        const d = document.createElement('div');
        d.className = 'heart';
        heartsEl.appendChild(d);
      }
    }
    for (let i = 0; i < maxHp; i++) {
      heartsEl.children[i].classList.toggle('empty', i >= hp);
    }

    // Powerups
    const puEl = $('hud-powerups');
    puEl.innerHTML = '';
    for (const [k, t] of Object.entries(powerups)) {
      if (t > 0) {
        const span = document.createElement('div');
        span.className = 'powerup-badge';
        span.innerHTML = `<span>${POWERUP_ICON[k] || '*'}</span><span>${POWERUP_LABEL[k] || k}</span><span>${t.toFixed(1)}s</span>`;
        puEl.appendChild(span);
      }
    }
  }

  toast(text, ms = 1500) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  showLevelComplete({ levelIndex, score, time, par, stars }) {
    const el = $('lc-stats');
    el.innerHTML = `
      <div class="row"><span>Level</span><b>${LEVELS[levelIndex].name}</b></div>
      <div class="row"><span>Score</span><b>${score}</b></div>
      <div class="row"><span>Time</span><b>${time.toFixed(1)}s</b></div>
      <div class="row"><span>Par</span><b>${par}s</b></div>
    `;
    const sEl = $('lc-stars');
    sEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const star = document.createElement('div');
      star.className = 'star' + (i < stars ? ' lit' : '');
      star.textContent = '★';
      sEl.appendChild(star);
    }
    this.showOverlay('levelcomplete');
  }

  showGameOver({ score, levelIndex, time }) {
    $('gameover-stats').innerHTML = `
      <div class="row"><span>Level</span><b>${LEVELS[levelIndex].name}</b></div>
      <div class="row"><span>Score</span><b>${score}</b></div>
      <div class="row"><span>Time</span><b>${time.toFixed(1)}s</b></div>
    `;
    this.showOverlay('gameover');
  }

  showVictory({ totalScore, totalTime, totalStars }) {
    $('victory-stats').innerHTML = `
      <div class="row"><span>Total Score</span><b>${totalScore}</b></div>
      <div class="row"><span>Total Time</span><b>${totalTime.toFixed(1)}s</b></div>
      <div class="row"><span>Stars Earned</span><b>${totalStars} / 15</b></div>
    `;
    this.showOverlay('victory');
  }

  showInfo(kind) {
    const t = $('info-title');
    const b = $('info-body');
    if (kind === 'how') {
      t.textContent = 'HOW TO PLAY';
      b.innerHTML = `
        <h3>Controls</h3>
        <ul>
          <li><kbd>W A S D</kbd> or arrows — move</li>
          <li><kbd>Space</kbd> — jump (double-jump with the green powerup)</li>
          <li><kbd>Shift</kbd> — dash (brief invincibility)</li>
          <li><kbd>P</kbd> — pause &middot; <kbd>M</kbd> — mute</li>
        </ul>
        <h3>Objective</h3>
        <p>Collect every coin in a level, then run to the glowing portal.</p>
        <h3>Power-ups</h3>
        <ul>
          <li><b style="color:#ff5577">❤ Heart</b> — restore one HP</li>
          <li><b style="color:#55aaff">◇ Shield</b> — absorbs one hit</li>
          <li><b style="color:#ffee44">⚡ Speed</b> — faster movement</li>
          <li><b style="color:#aa66ff">○ Magnet</b> — pulls nearby coins</li>
          <li><b style="color:#66ff99">↑↑ Jump</b> — adds a double-jump</li>
        </ul>
        <h3>Stars</h3>
        <p>Finish quickly and don't get hit to earn 3 stars per level.</p>
      `;
    } else if (kind === 'scores') {
      t.textContent = 'HIGH SCORES';
      const s = Storage.get();
      let html = '';
      if (s.highScores.length === 0) {
        html = '<p>No scores yet. Play a level!</p>';
      } else {
        html = '<ol class="score-list">';
        s.highScores.forEach((h, i) => {
          const ln = LEVELS[h.levelIndex]?.name || '?';
          html += `<li><span class="rank">#${i + 1}</span> <b>${h.score}</b> <span>${ln} · ${h.time.toFixed(1)}s</span></li>`;
        });
        html += '</ol>';
      }
      b.innerHTML = html;
    } else if (kind === 'credits') {
      t.textContent = 'CREDITS';
      b.innerHTML = `
        <p>A small 3D adventure built with Three.js and the Web Audio API.</p>
        <p>No external assets — everything is procedurally generated in code.</p>
        <p>Made for fun. Have a great quest!</p>
      `;
    }
    this.showOverlay('info');
  }
}
