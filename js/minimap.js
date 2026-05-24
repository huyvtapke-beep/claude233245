/**
 * Simple 2D minimap rendered on a canvas. Drawn from arena/world data.
 */
export class Minimap {
  constructor(container, size = 156) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  draw({ arenaSize, theme, player, coins, enemies, powerups, portal, portalActive }) {
    const ctx = this.ctx;
    const S = this.size;
    ctx.clearRect(0, 0, S, S);

    // Background
    const bgColors = {
      grass: ['#1a3624', '#0e1d14'],
      desert: ['#523a1a', '#1f1308'],
      snow: ['#39516b', '#19232f'],
      lava: ['#3a0e0e', '#150505'],
      space: ['#1a124a', '#06051a'],
    };
    const colors = bgColors[theme] || ['#222238', '#0a0a18'];
    const grad = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 1.5);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.5, 0.5, S - 1, S - 1);

    // Coordinate mapping: world (-arenaSize..+arenaSize) -> canvas (0..S)
    const scale = S / (arenaSize * 2);
    const worldToMap = (wx, wz) => [S / 2 + wx * scale, S / 2 + wz * scale];

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = -arenaSize; i <= arenaSize; i += 10) {
      const [, y] = worldToMap(0, i);
      const [x] = worldToMap(i, 0);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    }

    // Portal
    if (portal) {
      const [px, py] = worldToMap(portal.x, portal.z);
      ctx.fillStyle = portalActive ? '#aaffee' : 'rgba(170,200,220,0.5)';
      ctx.beginPath(); ctx.arc(px, py, portalActive ? 5 : 4, 0, Math.PI * 2); ctx.fill();
      if (portalActive) {
        ctx.strokeStyle = 'rgba(170,255,238,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // Coins
    ctx.fillStyle = '#ffd24a';
    for (const c of coins) {
      const [x, y] = worldToMap(c.x, c.z);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }

    // Powerups
    ctx.fillStyle = '#66ff99';
    for (const p of powerups) {
      const [x, y] = worldToMap(p.x, p.z);
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // Enemies
    for (const e of enemies) {
      const [x, y] = worldToMap(e.x, e.z);
      ctx.fillStyle = e.kind === 'boss' ? '#ff66ff' : (e.kind === 'spike' ? '#bbbbbb' : '#ff4d5c');
      const r = e.kind === 'boss' ? 4 : 2.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // Player
    const [px, py] = worldToMap(player.x, player.z);
    // Direction arrow
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.facing);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}
