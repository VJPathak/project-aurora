import { useEffect, useRef, useCallback } from "react";

/* ================================================================
   SPACE SHOOTER — GAME ENGINE
   Architecture mirrors a classic C++ game loop:
     - init()      → setup entities
     - update(dt)  → physics, AI, collisions
     - render()    → draw everything to canvas
   ================================================================ */

export type GameState = "menu" | "playing" | "paused" | "gameover";

interface GameCanvasProps {
  gameState: GameState;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  onStateChange: (state: GameState) => void;
}

// ── Entity types ──────────────────────────────────────────────
interface Vec2 { x: number; y: number; }

interface Player {
  pos: Vec2; width: number; height: number;
  speed: number; hp: number; maxHp: number;
  invincible: number; thrusterPhase: number;
}

interface Bullet {
  pos: Vec2; vel: Vec2; radius: number;
  owner: "player" | "enemy"; damage: number; life: number;
}

interface Enemy {
  pos: Vec2; vel: Vec2; width: number; height: number;
  hp: number; maxHp: number; type: number;
  shootTimer: number; shootInterval: number;
  sinOffset: number; sinAmp: number; sinSpeed: number;
  points: number;
}

interface Particle {
  pos: Vec2; vel: Vec2; radius: number;
  color: string; life: number; maxLife: number; alpha: number;
}

interface Star {
  pos: Vec2; speed: number; size: number; alpha: number;
}

interface FloatingText {
  pos: Vec2; text: string; color: string;
  life: number; maxLife: number;
}

// ── Helpers ───────────────────────────────────────────────────
const CYAN    = "#00f5ff";
const MAGENTA = "#ff00e5";
const GOLD    = "#ffd700";
const RED     = "#ff1a1a";
const GREEN   = "#00ff88";

function rectOverlap(ax: number, ay: number, aw: number, ah: number,
                     bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circRect(cx: number, cy: number, r: number,
                  rx: number, ry: number, rw: number, rh: number) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX, dy = cy - nearY;
  return dx * dx + dy * dy < r * r;
}

export default function GameCanvas({
  gameState, onScoreChange, onLivesChange,
  onLevelChange, onGameOver, onStateChange,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const lastTime  = useRef<number>(0);

  // Mutable game world (not React state — performance critical)
  const world = useRef({
    player:   null as Player | null,
    bullets:  [] as Bullet[],
    enemies:  [] as Enemy[],
    particles: [] as Particle[],
    stars:    [] as Star[],
    floats:   [] as FloatingText[],
    keys:     {} as Record<string, boolean>,
    score:    0,
    lives:    3,
    level:    1,
    wave:     0,
    waveTimer: 0,
    shootCooldown: 0,
    enemySpawnTimer: 0,
    enemySpawnInterval: 1.8,
    bossActive: false,
    shake: 0,
    time: 0,
  });

  // ── Init ────────────────────────────────────────────────────
  const init = useCallback((canvas: HTMLCanvasElement) => {
    const W = canvas.width, H = canvas.height;
    const w = world.current;

    w.player = {
      pos: { x: W / 2 - 20, y: H - 120 },
      width: 40, height: 50,
      speed: 320, hp: 3, maxHp: 3,
      invincible: 0, thrusterPhase: 0,
    };

    w.bullets  = [];
    w.enemies  = [];
    w.particles = [];
    w.floats   = [];
    w.score    = 0;
    w.lives    = 3;
    w.level    = 1;
    w.wave     = 0;
    w.waveTimer = 0;
    w.shootCooldown = 0;
    w.enemySpawnTimer = 0;
    w.enemySpawnInterval = 1.8;
    w.bossActive = false;
    w.shake    = 0;
    w.time     = 0;

    // Generate starfield
    w.stars = Array.from({ length: 180 }, () => ({
      pos: { x: Math.random() * W, y: Math.random() * H },
      speed: 0.3 + Math.random() * 2,
      size: Math.random() < 0.05 ? 2.5 : Math.random() < 0.2 ? 1.5 : 0.7,
      alpha: 0.3 + Math.random() * 0.7,
    }));

    onScoreChange(0);
    onLivesChange(3);
    onLevelChange(1);
  }, [onScoreChange, onLivesChange, onLevelChange]);

  // ── Spawn enemy ────────────────────────────────────────────
  const spawnEnemy = useCallback((canvas: HTMLCanvasElement) => {
    const w = world.current;
    const W = canvas.width;
    const lvl = w.level;
    const type = Math.random() < 0.15 + lvl * 0.05 ? 2 : Math.random() < 0.3 ? 1 : 0;

    const configs = [
      // type 0 — grunt
      { width: 36, height: 36, hp: 1 + Math.floor(lvl * 0.5), speed: 60 + lvl * 8,
        sinAmp: 30 + Math.random() * 40, sinSpeed: 1.5, shootInterval: 3.5, points: 100 },
      // type 1 — fast zigzag
      { width: 30, height: 32, hp: 1, speed: 110 + lvl * 10,
        sinAmp: 80 + Math.random() * 50, sinSpeed: 3.5, shootInterval: 99, points: 150 },
      // type 2 — tank / shooter
      { width: 50, height: 50, hp: 3 + Math.floor(lvl * 0.8), speed: 40 + lvl * 5,
        sinAmp: 15, sinSpeed: 0.8, shootInterval: 2.0, points: 250 },
    ];

    const cfg = configs[type];
    w.enemies.push({
      pos: { x: cfg.width / 2 + Math.random() * (W - cfg.width), y: -cfg.height },
      vel: { x: 0, y: cfg.speed },
      width: cfg.width, height: cfg.height,
      hp: cfg.hp, maxHp: cfg.hp,
      type,
      shootTimer: Math.random() * cfg.shootInterval,
      shootInterval: cfg.shootInterval * (0.8 + Math.random() * 0.4),
      sinOffset: Math.random() * Math.PI * 2,
      sinAmp: cfg.sinAmp, sinSpeed: cfg.sinSpeed,
      points: cfg.points,
    });
  }, []);

  // ── Spawn explosion particles ──────────────────────────────
  const explode = useCallback((x: number, y: number, color: string, count = 18) => {
    const w = world.current;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 60 + Math.random() * 140;
      w.particles.push({
        pos: { x, y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        radius: 1.5 + Math.random() * 4,
        color, life: 0.4 + Math.random() * 0.6, maxLife: 1, alpha: 1,
      });
    }
  }, []);

  // ── Update (dt in seconds) ─────────────────────────────────
  const update = useCallback((dt: number, canvas: HTMLCanvasElement) => {
    const w = world.current;
    const W = canvas.width, H = canvas.height;
    if (!w.player) return;
    const p = w.player;

    w.time += dt;
    w.shake = Math.max(0, w.shake - dt * 8);

    // ── Player movement ──
    p.thrusterPhase += dt * 10;
    const spd = p.speed * dt;
    if ((w.keys["ArrowLeft"] || w.keys["a"] || w.keys["A"]) && p.pos.x > 0)
      p.pos.x = Math.max(0, p.pos.x - spd);
    if ((w.keys["ArrowRight"] || w.keys["d"] || w.keys["D"]) && p.pos.x + p.width < W)
      p.pos.x = Math.min(W - p.width, p.pos.x + spd);
    if ((w.keys["ArrowUp"] || w.keys["w"] || w.keys["W"]) && p.pos.y > 0)
      p.pos.y = Math.max(0, p.pos.y - spd);
    if ((w.keys["ArrowDown"] || w.keys["s"] || w.keys["S"]) && p.pos.y + p.height < H)
      p.pos.y = Math.min(H - p.height, p.pos.y + spd);

    p.invincible = Math.max(0, p.invincible - dt);

    // ── Player shoot ──
    w.shootCooldown = Math.max(0, w.shootCooldown - dt);
    if (w.keys[" "] && w.shootCooldown <= 0) {
      w.shootCooldown = 0.18;
      const cx = p.pos.x + p.width / 2;
      const cy = p.pos.y;
      w.bullets.push({ pos: { x: cx - 2, y: cy }, vel: { x: 0, y: -700 }, radius: 4, owner: "player", damage: 1, life: 2 });
      if (w.level >= 3) {
        w.bullets.push({ pos: { x: cx - 14, y: cy + 10 }, vel: { x: -40, y: -700 }, radius: 3, owner: "player", damage: 1, life: 2 });
        w.bullets.push({ pos: { x: cx + 10, y: cy + 10 }, vel: { x: 40,  y: -700 }, radius: 3, owner: "player", damage: 1, life: 2 });
      }
    }

    // ── Enemy spawning ──
    w.enemySpawnTimer += dt;
    if (w.enemySpawnTimer >= w.enemySpawnInterval) {
      w.enemySpawnTimer = 0;
      spawnEnemy(canvas);
      const maxI = Math.max(0.5, w.enemySpawnInterval - w.level * 0.05);
      w.enemySpawnInterval = maxI;
    }

    // ── Enemy update ──
    for (let i = w.enemies.length - 1; i >= 0; i--) {
      const e = w.enemies[i];
      e.pos.y += e.vel.y * dt;
      e.pos.x += Math.sin(w.time * e.sinSpeed + e.sinOffset) * e.sinAmp * dt;
      e.pos.x = Math.max(0, Math.min(W - e.width, e.pos.x));

      // Enemy shoot
      if (e.shootInterval < 90) {
        e.shootTimer += dt;
        if (e.shootTimer >= e.shootInterval) {
          e.shootTimer = 0;
          const cx = e.pos.x + e.width / 2;
          const cy = e.pos.y + e.height;
          // Aim at player
          const dx = (p.pos.x + p.width / 2) - cx;
          const dy = (p.pos.y + p.height / 2) - cy;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const spd2 = 200 + w.level * 15;
          w.bullets.push({ pos: { x: cx, y: cy }, vel: { x: (dx / len) * spd2, y: (dy / len) * spd2 }, radius: 5, owner: "enemy", damage: 1, life: 3 });
        }
      }

      // Off screen
      if (e.pos.y > H + 60) { w.enemies.splice(i, 1); continue; }

      // Player collision
      if (p.invincible <= 0 &&
          rectOverlap(p.pos.x, p.pos.y, p.width, p.height,
                      e.pos.x, e.pos.y, e.width, e.height)) {
        explode(e.pos.x + e.width / 2, e.pos.y + e.height / 2, RED, 20);
        w.enemies.splice(i, 1);
        p.invincible = 2.5;
        w.lives -= 1;
        w.shake = 1;
        onLivesChange(w.lives);
        w.floats.push({ pos: { x: p.pos.x + p.width / 2, y: p.pos.y }, text: "HIT!", color: RED, life: 1, maxLife: 1 });
        if (w.lives <= 0) {
          onGameOver(w.score);
          return;
        }
      }
    }

    // ── Bullet update ──
    for (let i = w.bullets.length - 1; i >= 0; i--) {
      const b = w.bullets[i];
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;
      b.life  -= dt;

      if (b.life <= 0 || b.pos.y < -20 || b.pos.y > H + 20 || b.pos.x < -20 || b.pos.x > W + 20) {
        w.bullets.splice(i, 1); continue;
      }

      if (b.owner === "player") {
        for (let j = w.enemies.length - 1; j >= 0; j--) {
          const e = w.enemies[j];
          if (circRect(b.pos.x, b.pos.y, b.radius, e.pos.x, e.pos.y, e.width, e.height)) {
            e.hp -= b.damage;
            explode(b.pos.x, b.pos.y, CYAN, 6);
            w.bullets.splice(i, 1);
            if (e.hp <= 0) {
              const pts = e.points * w.level;
              w.score += pts;
              onScoreChange(w.score);
              explode(e.pos.x + e.width / 2, e.pos.y + e.height / 2,
                      e.type === 2 ? MAGENTA : e.type === 1 ? GOLD : CYAN, 22);
              w.floats.push({ pos: { x: e.pos.x + e.width / 2, y: e.pos.y },
                text: `+${pts}`, color: GOLD, life: 1.2, maxLife: 1.2 });
              w.enemies.splice(j, 1);
              w.wave++;
              // Level up every 12 kills
              if (w.wave % 12 === 0) {
                w.level++;
                onLevelChange(w.level);
                w.floats.push({ pos: { x: W / 2, y: H / 2 }, text: `LEVEL ${w.level}!`, color: GREEN, life: 2, maxLife: 2 });
              }
            }
            break;
          }
        }
      } else {
        // Enemy bullet → player
        if (p.invincible <= 0 &&
            circRect(b.pos.x, b.pos.y, b.radius, p.pos.x, p.pos.y, p.width, p.height)) {
          w.bullets.splice(i, 1);
          p.invincible = 2.5;
          w.lives -= 1;
          w.shake = 0.7;
          onLivesChange(w.lives);
          explode(p.pos.x + p.width / 2, p.pos.y + p.height / 2, RED, 14);
          w.floats.push({ pos: { x: p.pos.x + p.width / 2, y: p.pos.y }, text: "HIT!", color: RED, life: 1, maxLife: 1 });
          if (w.lives <= 0) { onGameOver(w.score); return; }
        }
      }
    }

    // ── Particles ──
    for (let i = w.particles.length - 1; i >= 0; i--) {
      const pt = w.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { w.particles.splice(i, 1); continue; }
      pt.pos.x += pt.vel.x * dt;
      pt.pos.y += pt.vel.y * dt;
      pt.vel.x *= 1 - 3 * dt;
      pt.vel.y *= 1 - 3 * dt;
      pt.alpha = pt.life / pt.maxLife;
      pt.radius *= 1 - 0.8 * dt;
    }

    // ── Floating texts ──
    for (let i = w.floats.length - 1; i >= 0; i--) {
      const ft = w.floats[i];
      ft.life -= dt;
      ft.pos.y -= 40 * dt;
      if (ft.life <= 0) w.floats.splice(i, 1);
    }

    // ── Stars ──
    for (const star of w.stars) {
      star.pos.y += star.speed * dt * (30 + w.level * 2);
      if (star.pos.y > H) { star.pos.y = 0; star.pos.x = Math.random() * W; }
    }
  }, [spawnEnemy, explode, onScoreChange, onLivesChange, onLevelChange, onGameOver]);

  // ── Render ─────────────────────────────────────────────────
  const render = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    const w = world.current;
    if (!w.player) return;
    const p = w.player;

    ctx.save();
    // Screen shake
    if (w.shake > 0) {
      const mag = w.shake * 8;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    // ── Background ──
    ctx.fillStyle = "#040a14";
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (const star of w.stars) {
      ctx.save();
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(star.pos.x, star.pos.y, star.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Particles ──
    for (const pt of w.particles) {
      ctx.save();
      ctx.globalAlpha = pt.alpha;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.pos.x, pt.pos.y, Math.max(0.1, pt.radius), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Enemy bullets ──
    for (const b of w.bullets) {
      if (b.owner !== "enemy") continue;
      ctx.save();
      ctx.shadowColor = RED;
      ctx.shadowBlur = 14;
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      // trail
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#ff8888";
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y - b.vel.y * 0.03, b.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Player bullets ──
    for (const b of w.bullets) {
      if (b.owner !== "player") continue;
      ctx.save();
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 16;
      // laser rod
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = b.radius * 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(b.pos.x, b.pos.y);
      ctx.lineTo(b.pos.x - b.vel.x * 0.03, b.pos.y + 18);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, b.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Enemies ──
    const drawEnemy = (e: Enemy) => {
      const cx = e.pos.x + e.width / 2, cy = e.pos.y + e.height / 2;
      const colors = [MAGENTA, GOLD, RED];
      const color = colors[e.type];
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;

      if (e.type === 0) {
        // Grunt — diamond
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, e.pos.y);
        ctx.lineTo(e.pos.x + e.width, cy);
        ctx.lineTo(cx, e.pos.y + e.height);
        ctx.lineTo(e.pos.x, cy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#ffffff44";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (e.type === 1) {
        // Fast — triangle pointing down
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, e.pos.y + e.height);
        ctx.lineTo(e.pos.x, e.pos.y);
        ctx.lineTo(e.pos.x + e.width, e.pos.y);
        ctx.closePath();
        ctx.fill();
      } else {
        // Tank — hexagon
        ctx.fillStyle = color + "aa";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI / 3) * i - Math.PI / 6;
          const r = e.width / 2;
          if (i === 0) ctx.moveTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
          else ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // HP bar
      if (e.maxHp > 1) {
        const bw = e.width, bh = 4;
        const bx = e.pos.x, by = e.pos.y - 10;
        ctx.fillStyle = "#ffffff22";
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = color;
        ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
      }
      ctx.restore();
    };

    for (const e of w.enemies) drawEnemy(e);

    // ── Player ship ──
    const px = p.pos.x, py = p.pos.y;
    const pw = p.width, ph = p.height;
    const pcx = px + pw / 2;

    ctx.save();
    const inv = p.invincible > 0 && Math.floor(p.invincible * 10) % 2 === 0;
    if (inv) ctx.globalAlpha = 0.3;

    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 22;

    // Thruster flame
    const flameH = 12 + Math.sin(p.thrusterPhase) * 8;
    const grad = ctx.createLinearGradient(pcx, py + ph, pcx, py + ph + flameH + 10);
    grad.addColorStop(0, CYAN + "ff");
    grad.addColorStop(0.5, "#ff8800cc");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pcx - 8, py + ph - 4);
    ctx.lineTo(pcx, py + ph + flameH + 10);
    ctx.lineTo(pcx + 8, py + ph - 4);
    ctx.closePath();
    ctx.fill();

    // Main hull
    ctx.fillStyle = "#0d1f2d";
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pcx, py);                       // nose
    ctx.lineTo(px + pw * 0.85, py + ph * 0.7);
    ctx.lineTo(px + pw, py + ph);              // right wing tip
    ctx.lineTo(px + pw * 0.6, py + ph * 0.75);
    ctx.lineTo(pcx, py + ph * 0.65);           // cockpit rear
    ctx.lineTo(px + pw * 0.4, py + ph * 0.75);
    ctx.lineTo(px, py + ph);                   // left wing tip
    ctx.lineTo(px + pw * 0.15, py + ph * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cockpit
    const cpGrad = ctx.createRadialGradient(pcx, py + ph * 0.3, 2, pcx, py + ph * 0.3, 12);
    cpGrad.addColorStop(0, "#00f5ff88");
    cpGrad.addColorStop(1, "transparent");
    ctx.fillStyle = cpGrad;
    ctx.beginPath();
    ctx.ellipse(pcx, py + ph * 0.3, 9, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = CYAN + "99";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Gun ports
    ctx.fillStyle = CYAN;
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(px + pw * 0.15, py + ph * 0.65, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + pw * 0.85, py + ph * 0.65, 3, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    // ── Floating texts ──
    for (const ft of w.floats) {
      const alpha = ft.life / ft.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = ft.color;
      const size = ft.text.startsWith("LEVEL") ? 28 : ft.text === "HIT!" ? 22 : 18;
      ctx.font = `bold ${size}px 'Orbitron', monospace`;
      ctx.textAlign = "center";
      ctx.fillText(ft.text, ft.pos.x, ft.pos.y);
      ctx.restore();
    }

    ctx.restore(); // shake restore
  }, []);

  // ── Game loop ───────────────────────────────────────────────
  const loop = useCallback((timestamp: number) => {
    if (!canvasRef.current) return;
    const dt = Math.min((timestamp - lastTime.current) / 1000, 0.05);
    lastTime.current = timestamp;
    update(dt, canvasRef.current);
    render(canvasRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, [update, render]);

  // ── Effect: start / stop based on gameState ────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (gameState === "playing") {
      init(canvas);
      lastTime.current = performance.now();
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
    }

    return () => { cancelAnimationFrame(rafRef.current); };
  }, [gameState, init, loop]);

  // ── Keyboard ────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      world.current.keys[e.key] = true;
      if (e.key === " ") e.preventDefault();
      if (e.key === "Escape" && gameState === "playing") {
        onStateChange("paused");
      }
    };
    const up = (e: KeyboardEvent) => { world.current.keys[e.key] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [gameState, onStateChange]);

  // ── Resize ─────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
