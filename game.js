'use strict';

/* =====================================================================
   SAMURAI SLASH — game.js
   Pure vanilla JavaScript + HTML5 Canvas. No frameworks, no assets.
   Every visual (moon, mountains, samurai, oni, petals) is drawn in code.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. CANVAS SETUP
   --------------------------------------------------------------------- */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* ---------------------------------------------------------------------
   2. DOM REFERENCES
   --------------------------------------------------------------------- */

const hpBarInner     = document.getElementById('hpBarInner');
const scoreValueEl   = document.getElementById('scoreValue');
const killsValueEl   = document.getElementById('killsValue');

const startScreen    = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalStatsEl   = document.getElementById('finalStats');
const startBtn       = document.getElementById('startBtn');
const restartBtn     = document.getElementById('restartBtn');

const joystickBase   = document.getElementById('joystickBase');
const joystickKnob   = document.getElementById('joystickKnob');
const attackBtn      = document.getElementById('attackBtn');

/* ---------------------------------------------------------------------
   3. TOUCH DEVICE DETECTION
   --------------------------------------------------------------------- */

const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
  document.body.classList.add('touch-device');
}

/* ---------------------------------------------------------------------
   4. GLOBAL GAME STATE
   --------------------------------------------------------------------- */

let gameState = 'start'; // 'start' | 'playing' | 'gameover'
let lastTime = 0;
let timeAccum = 0; // used for ambient animation (star twinkle, etc.)

let score = 0;
let kills = 0;

/* Input state, shared by keyboard / mouse / touch handlers below. */
const keys = {};
const mouse = { x: 0, y: 0 };
const joystick = { active: false, dx: 0, dy: 0, centerX: 0, centerY: 0 };
let attackRequested = false;

/* ---------------------------------------------------------------------
   5. PLAYER
   --------------------------------------------------------------------- */

const player = {
  x: 0,
  y: 0,
  radius: 18,
  speed: 230,           // pixels per second
  hp: 100,
  maxHp: 100,
  facingAngle: 0,
  attacking: false,
  attackTimer: 0,
  attackDuration: 0.18,
  attackCooldown: 0,
  attackCooldownMax: 0.32,
  hitFlash: 0            // seconds remaining of red damage flash
};

function resetPlayer() {
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.hp = player.maxHp;
  player.facingAngle = 0;
  player.attacking = false;
  player.attackTimer = 0;
  player.attackCooldown = 0;
  player.hitFlash = 0;
}

function updatePlayer(dt) {
  let mx = 0;
  let my = 0;
  let usingJoystick = false;

  if (isTouchDevice && joystick.active) {
    // Joystick already gives a vector with magnitude <= 1 (partial = partial speed).
    mx = joystick.dx;
    my = joystick.dy;
    usingJoystick = true;
  } else {
    if (keys['w'] || keys['arrowup'])    my -= 1;
    if (keys['s'] || keys['arrowdown'])  my += 1;
    if (keys['a'] || keys['arrowleft'])  mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
    }
  }

  const moveLen = Math.hypot(mx, my);
  if (moveLen > 0.01) {
    player.x += mx * player.speed * dt;
    player.y += my * player.speed * dt;
    if (usingJoystick) {
      player.facingAngle = Math.atan2(my, mx);
    }
  }

  // Keep the samurai inside the playfield.
  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

  // On desktop, the player always faces the mouse cursor (aiming for the slash).
  if (!isTouchDevice) {
    player.facingAngle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  }

  // Attack animation / cooldown timers.
  if (player.attackTimer > 0) {
    player.attackTimer -= dt;
    if (player.attackTimer <= 0) player.attacking = false;
  }
  if (player.attackCooldown > 0) player.attackCooldown -= dt;
  if (player.hitFlash > 0) player.hitFlash -= dt;

  if (attackRequested) {
    attackRequested = false;
    tryAttack();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  // Soft ground shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, player.radius * 0.9, player.radius * 0.9, player.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(player.facingAngle);

  // Robe / body silhouette.
  ctx.fillStyle = '#1d2a44';
  ctx.beginPath();
  ctx.moveTo(-player.radius * 0.9, player.radius * 0.9);
  ctx.lineTo(player.radius * 1.1, 0);
  ctx.lineTo(-player.radius * 0.9, -player.radius * 0.9);
  ctx.lineTo(-player.radius * 0.4, 0);
  ctx.closePath();
  ctx.fill();

  // Sash across the chest.
  ctx.strokeStyle = '#c1272d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-player.radius * 0.6, -player.radius * 0.3);
  ctx.lineTo(player.radius * 0.3, player.radius * 0.3);
  ctx.stroke();

  // Head.
  ctx.fillStyle = '#e8c9a0';
  ctx.beginPath();
  ctx.arc(player.radius * 0.55, 0, player.radius * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Headband.
  ctx.fillStyle = '#c1272d';
  ctx.fillRect(player.radius * 0.2, -player.radius * 0.45, player.radius * 0.7, player.radius * 0.18);

  // Katana — swings through an arc during the attack animation.
  let swordAngleOffset;
  if (player.attacking) {
    const progress = 1 - (player.attackTimer / player.attackDuration);
    swordAngleOffset = -1.0 + progress * 2.0; // sweeps from -1 rad to +1 rad
  } else {
    swordAngleOffset = 0.3; // resting position
  }

  ctx.save();
  ctx.rotate(swordAngleOffset);
  ctx.strokeStyle = '#dcdcdc';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(player.radius * 0.6, 0);
  ctx.lineTo(player.radius * 2.3, 0);
  ctx.stroke();
  // Hilt.
  ctx.strokeStyle = '#8a6d1f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(player.radius * 0.4, 0);
  ctx.lineTo(player.radius * 0.65, 0);
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  // Damage flash, drawn unrotated in screen space.
  if (player.hitFlash > 0) {
    const flashAlpha = Math.min(0.55, player.hitFlash * 2.2);
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = `rgba(193, 39, 45, ${flashAlpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ---------------------------------------------------------------------
   6. ENEMIES (oni — one enemy type, as specified)
   --------------------------------------------------------------------- */

const enemies = [];
let enemySpawnTimer = 0;
let enemySpawnInterval = 1.4; // seconds between spawns, ramps down over time

function spawnEnemy() {
  const margin = 40;
  const edge = Math.floor(Math.random() * 4);
  let x, y;

  switch (edge) {
    case 0: x = Math.random() * canvas.width; y = -margin; break;                       // top
    case 1: x = canvas.width + margin; y = Math.random() * canvas.height; break;        // right
    case 2: x = Math.random() * canvas.width; y = canvas.height + margin; break;        // bottom
    default: x = -margin; y = Math.random() * canvas.height; break;                     // left
  }

  enemies.push({
    x, y,
    radius: 16,
    hp: 20,
    maxHp: 20,
    speed: 65 + Math.random() * 45,
    damage: 10,
    damageCooldown: 0,
    bobPhase: Math.random() * Math.PI * 2,
    hitFlash: 0
  });
}

function updateEnemies(dt) {
  // Spawning, with a slow difficulty ramp and a sane cap for performance.
  enemySpawnTimer += dt;
  if (enemySpawnTimer >= enemySpawnInterval && enemies.length < 40) {
    enemySpawnTimer = 0;
    spawnEnemy();
    if (enemySpawnInterval > 0.55) {
      enemySpawnInterval -= 0.008;
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;

    e.x += (dx / dist) * e.speed * dt;
    e.y += (dy / dist) * e.speed * dt;
    e.bobPhase += dt * 6;

    if (e.damageCooldown > 0) e.damageCooldown -= dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;

    // Contact damage to the player, throttled per-enemy so it doesn't melt HP instantly.
    const collideDist = e.radius + player.radius;
    if (dist < collideDist && e.damageCooldown <= 0 && gameState === 'playing') {
      damagePlayer(e.damage);
      e.damageCooldown = 1.0;
    }

    if (e.hp <= 0) {
      killEnemy(i);
    }
  }
}

function killEnemy(index) {
  const e = enemies[index];
  spawnDeathParticles(e.x, e.y);
  enemies.splice(index, 1);
  score += 10;
  kills += 1;
  updateHud();
}

function drawEnemies() {
  for (const e of enemies) {
    const bob = Math.sin(e.bobPhase) * 2;

    ctx.save();
    ctx.translate(e.x, e.y);

    // Ground shadow.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, e.radius * 0.9, e.radius * 0.9, e.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, bob);

    // Body — flashes white for a frame when hit.
    ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#3a1620';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();

    // Horns.
    ctx.fillStyle = '#1a0a0e';
    ctx.beginPath();
    ctx.moveTo(-e.radius * 0.5, -e.radius * 0.7);
    ctx.lineTo(-e.radius * 0.2, -e.radius * 1.4);
    ctx.lineTo(-e.radius * 0.05, -e.radius * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(e.radius * 0.5, -e.radius * 0.7);
    ctx.lineTo(e.radius * 0.2, -e.radius * 1.4);
    ctx.lineTo(e.radius * 0.05, -e.radius * 0.6);
    ctx.closePath();
    ctx.fill();

    // Glowing red eyes.
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(-e.radius * 0.35, -e.radius * 0.1, e.radius * 0.16, 0, Math.PI * 2);
    ctx.arc(e.radius * 0.35, -e.radius * 0.1, e.radius * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Mini health bar above the enemy.
    const barW = e.radius * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(e.x - barW / 2, e.y - e.radius - 12, barW, 4);
    ctx.fillStyle = '#c1272d';
    ctx.fillRect(e.x - barW / 2, e.y - e.radius - 12, barW * (e.hp / e.maxHp), 4);
  }
}

/* ---------------------------------------------------------------------
   7. COMBAT
   --------------------------------------------------------------------- */

function tryAttack() {
  if (gameState !== 'playing') return;
  if (player.attackCooldown > 0) return;

  player.attacking = true;
  player.attackTimer = player.attackDuration;
  player.attackCooldown = player.attackCooldownMax;

  spawnSlashEffect(player.x, player.y, player.facingAngle);

  const range = player.radius + 65;
  const halfArc = 1.05; // radians either side of facing angle (~120 degree cone)

  for (const e of enemies) {
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range) continue;

    const angleTo = Math.atan2(dy, dx);
    let diff = angleTo - player.facingAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // normalize to [-PI, PI]

    if (Math.abs(diff) <= halfArc) {
      e.hp -= 20; // one clean slash is enough to fell an oni (20 HP)
      e.hitFlash = 0.15;
    }
  }
}

function damagePlayer(amount) {
  player.hp -= amount;
  player.hitFlash = 0.25;
  if (player.hp <= 0) {
    player.hp = 0;
    triggerGameOver();
  }
  updateHud();
}

/* ---------------------------------------------------------------------
   8. PARTICLE EFFECTS (slash sparks, enemy death bursts, sakura petals)
   --------------------------------------------------------------------- */

const slashEffects = []; // fading arcs drawn when the player attacks
const burstParticles = []; // small dots used for slash sparks + death bursts

function spawnSlashEffect(x, y, angle) {
  slashEffects.push({ x, y, angle, life: 0.18, maxLife: 0.18 });

  for (let i = 0; i < 8; i++) {
    const a = angle + (Math.random() - 0.5) * 1.2;
    const speed = 150 + Math.random() * 150;
    burstParticles.push({
      x: x + Math.cos(angle) * 30,
      y: y + Math.sin(angle) * 30,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.25 + Math.random() * 0.15,
      maxLife: 0.4,
      size: 2 + Math.random() * 2,
      color: '#f4ecd8'
    });
  }
}

function spawnDeathParticles(x, y) {
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 120;
    burstParticles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.7,
      size: 3 + Math.random() * 3,
      color: Math.random() > 0.5 ? '#c1272d' : '#7a1014'
    });
  }
}

function updateEffects(dt) {
  for (let i = slashEffects.length - 1; i >= 0; i--) {
    slashEffects[i].life -= dt;
    if (slashEffects[i].life <= 0) slashEffects.splice(i, 1);
  }

  for (let i = burstParticles.length - 1; i >= 0; i--) {
    const p = burstParticles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
    if (p.life <= 0) burstParticles.splice(i, 1);
  }
}

function drawEffects() {
  for (const s of slashEffects) {
    const t = s.life / s.maxLife;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.strokeStyle = `rgba(244, 236, 216, ${t})`;
    ctx.lineWidth = 4 * t + 1;
    ctx.beginPath();
    ctx.arc(0, 0, 55, -0.9, 0.9);
    ctx.stroke();
    ctx.restore();
  }

  for (const p of burstParticles) {
    const t = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = t;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* --- Sakura petals: a calm ambient layer that runs on every screen --- */

const sakuraPetals = [];
const NUM_SAKURA = 45;

function createSakuraPetal(randomY) {
  return {
    x: Math.random() * canvas.width,
    y: randomY ? Math.random() * canvas.height : -10,
    size: 4 + Math.random() * 6,
    speed: 30 + Math.random() * 40,
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.5 + Math.random() * 1.0,
    swayAmp: 20 + Math.random() * 30,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 2,
    color: Math.random() > 0.5 ? '#f7c9d4' : '#f2a9bd'
  };
}

function initSakura() {
  sakuraPetals.length = 0;
  for (let i = 0; i < NUM_SAKURA; i++) {
    sakuraPetals.push(createSakuraPetal(true));
  }
}

function updateSakura(dt) {
  for (const p of sakuraPetals) {
    p.y += p.speed * dt;
    p.sway += p.swaySpeed * dt;
    p.x += Math.sin(p.sway) * p.swayAmp * dt * 0.5;
    p.rotation += p.rotSpeed * dt;

    if (p.y > canvas.height + 20) {
      p.y = -20;
      p.x = Math.random() * canvas.width;
    }
    if (p.x < -30) p.x = canvas.width + 20;
    if (p.x > canvas.width + 30) p.x = -20;
  }
}

function drawSakura() {
  for (const p of sakuraPetals) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ---------------------------------------------------------------------
   9. BACKGROUND — night sky, stars, moon, mountains, torii gate
   --------------------------------------------------------------------- */

const stars = [];

function initStars() {
  stars.length = 0;
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random() * 0.6,
      size: Math.random() * 1.8 + 0.3,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.5 + Math.random() * 1.5
    });
  }
}

function drawBackground(dt) {
  const w = canvas.width;
  const h = canvas.height;

  // Night sky gradient.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#05060d');
  sky.addColorStop(0.55, '#0d1224');
  sky.addColorStop(1, '#1a2238');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Twinkling stars.
  timeAccum += dt;
  for (const s of stars) {
    const tw = 0.5 + 0.5 * Math.sin(timeAccum * s.twinkleSpeed + s.twinklePhase);
    ctx.globalAlpha = 0.3 + tw * 0.7;
    ctx.fillStyle = '#f4ecd8';
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h * 0.7, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Moon with soft glow.
  const moonX = w * 0.78;
  const moonY = h * 0.18;
  const moonR = Math.min(w, h) * 0.07;

  const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 4);
  glow.addColorStop(0, 'rgba(244, 236, 216, 0.35)');
  glow.addColorStop(1, 'rgba(244, 236, 216, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f4ecd8';
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(200, 190, 165, 0.4)';
  ctx.beginPath();
  ctx.arc(moonX - moonR * 0.3, moonY - moonR * 0.2, moonR * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(moonX + moonR * 0.25, moonY + moonR * 0.3, moonR * 0.12, 0, Math.PI * 2);
  ctx.fill();

  // Layered mountain silhouettes for depth.
  drawMountainLayer(h * 0.62, h * 0.18, '#161d33', 7);
  drawMountainLayer(h * 0.72, h * 0.22, '#0e1322', 5);

  // Torii gate — the signature silhouette of the scene.
  drawTorii(w * 0.18, h * 0.78, Math.min(w, h) * 0.16);

  // Ground.
  ctx.fillStyle = '#070a12';
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
}

function drawMountainLayer(baseY, amplitude, color, peaks) {
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, baseY);

  const step = w / peaks;
  for (let i = 0; i <= peaks; i++) {
    const x = i * step;
    // Deterministic jagged profile (no randomness here so it stays still, not flickery).
    const y = baseY - Math.abs(Math.sin(i * 1.7 + peaks)) * amplitude - amplitude * 0.3;
    ctx.lineTo(x, y);
  }

  ctx.lineTo(w, baseY);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function drawTorii(x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#0a0d16';

  const legW = size * 0.08;
  const legH = size * 0.55;
  const spread = size * 0.5;

  // Two legs.
  ctx.fillRect(-spread, -legH, legW, legH);
  ctx.fillRect(spread - legW, -legH, legW, legH);

  // Top beam (kasagi).
  ctx.fillRect(-spread - size * 0.08, -legH - size * 0.1, spread * 2 + size * 0.16, size * 0.07);

  // Second beam (nuki).
  ctx.fillRect(-spread - size * 0.02, -legH - size * 0.22, spread * 2 + size * 0.04, size * 0.05);

  ctx.restore();
}

/* ---------------------------------------------------------------------
   10. HUD / SCREEN STATE
   --------------------------------------------------------------------- */

function updateHud() {
  hpBarInner.style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%';
  scoreValueEl.textContent = score;
  killsValueEl.textContent = kills;
}

function triggerGameOver() {
  gameState = 'gameover';
  finalStatsEl.textContent = `Final Score: ${score}   |   Kills: ${kills}`;
  gameOverScreen.classList.remove('hidden');
}

function startGame() {
  score = 0;
  kills = 0;
  enemies.length = 0;
  burstParticles.length = 0;
  slashEffects.length = 0;
  enemySpawnTimer = 0;
  enemySpawnInterval = 1.4;

  resetPlayer();
  updateHud();

  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');

  gameState = 'playing';
}

/* ---------------------------------------------------------------------
   11. MAIN LOOP
   --------------------------------------------------------------------- */

function update(dt) {
  updateSakura(dt);

  if (gameState === 'playing') {
    updatePlayer(dt);
    updateEnemies(dt);
  }

  updateEffects(dt);
}

function draw(dt) {
  drawBackground(dt);
  drawSakura();

  if (gameState === 'playing' || gameState === 'gameover') {
    drawEnemies();
    drawPlayer();
  }

  drawEffects();
}

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  if (dt > 0.05) dt = 0.05; // clamp huge gaps (e.g. tab was inactive)

  update(dt);
  draw(dt);

  requestAnimationFrame(gameLoop);
}

/* ---------------------------------------------------------------------
   12. INPUT HANDLING — keyboard, mouse, touch
   --------------------------------------------------------------------- */

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return; // left click only
  attackRequested = true;
});

// Prevent the right-click context menu from interrupting play.
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

/* --- Mobile virtual joystick --- */

function updateJoystickFromTouch(touch) {
  const maxDist = 35;
  let dx = touch.clientX - joystick.centerX;
  let dy = touch.clientY - joystick.centerY;
  const dist = Math.hypot(dx, dy);

  if (dist > maxDist) {
    dx = (dx / dist) * maxDist;
    dy = (dy / dist) * maxDist;
  }

  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

  const mag = Math.min(1, dist / maxDist);
  const angle = Math.atan2(dy, dx);
  joystick.dx = Math.cos(angle) * mag;
  joystick.dy = Math.sin(angle) * mag;
}

joystickBase.addEventListener('touchstart', (e) => {
  e.preventDefault();
  joystick.active = true;
  const rect = joystickBase.getBoundingClientRect();
  joystick.centerX = rect.left + rect.width / 2;
  joystick.centerY = rect.top + rect.height / 2;
  updateJoystickFromTouch(e.touches[0]);
}, { passive: false });

joystickBase.addEventListener('touchmove', (e) => {
  e.preventDefault();
  updateJoystickFromTouch(e.touches[0]);
}, { passive: false });

function releaseJoystick(e) {
  e.preventDefault();
  joystick.active = false;
  joystick.dx = 0;
  joystick.dy = 0;
  joystickKnob.style.transform = 'translate(0px, 0px)';
}

joystickBase.addEventListener('touchend', releaseJoystick, { passive: false });
joystickBase.addEventListener('touchcancel', releaseJoystick, { passive: false });

/* --- Mobile attack button --- */

attackBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  attackRequested = true;
}, { passive: false });

// Also respond to a plain click, for hybrid touch/mouse laptops.
attackBtn.addEventListener('click', () => {
  attackRequested = true;
});

/* ---------------------------------------------------------------------
   13. BOOT
   --------------------------------------------------------------------- */

initSakura();
initStars();
updateHud();
requestAnimationFrame(gameLoop);
