import { useEffect, useRef, useCallback } from "react";

const W = 300;
const H = 500;
const GRAVITY = 0.3;
const JUMP = -10;
const PLAYER_W = 36;
const PLAYER_H = 30;
const PLAT_W = 58;
const PLAT_H = 11;
const SPEED = 4.5;

interface Platform {
  x: number;
  y: number;
  type: "green" | "blue" | "brown" | "white";
  dx: number;
  broken: boolean;
  breakAnim: number;
  spring: boolean;
  springAnim: number;
}

interface Monster {
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dead: boolean;
  deadAnim: number;
}

interface Bullet {
  x: number;
  y: number;
}

function makePlatform(x: number, y: number, score: number): Platform {
  const r = Math.random();
  let type: Platform["type"] = "green";
  if (score > 2000 && r < 0.08) type = "brown";
  else if (score > 1000 && r < 0.15) type = "white";
  else if (score > 500 && r < 0.20) type = "blue";

  return {
    x, y, type,
    dx: type === "blue" ? (Math.random() > 0.5 ? 1.5 : -1.5) : 0,
    broken: false,
    breakAnim: 0,
    spring: type === "green" && Math.random() < 0.12,
    springAnim: 0,
  };
}

export default function DoodleJump() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef({
    px: W / 2 - PLAYER_W / 2,
    py: H - 150,
    vx: 0,
    vy: JUMP,
    facingLeft: false,
    score: 0,
    best: 0,
    camY: 0,
    platforms: [] as Platform[],
    monsters: [] as Monster[],
    bullets: [] as Bullet[],
    keys: { left: false, right: false, shoot: false },
    shootCooldown: 0,
    state: "start" as "start" | "play" | "dead",
    deadTimer: 0,
    frameId: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
  });

  const initPlatforms = () => {
    const platforms: Platform[] = [];
    // Starting platform under player
    platforms.push(makePlatform(W / 2 - PLAT_W / 2, H - 100, 0));
    const gap = H / 10;
    for (let i = 1; i < 14; i++) {
      platforms.push(makePlatform(Math.random() * (W - PLAT_W), H - 100 - i * gap, 0));
    }
    return platforms;
  };

  const reset = useCallback(() => {
    const g = gameRef.current;
    g.px = W / 2 - PLAYER_W / 2;
    g.py = H - 150;
    g.vx = 0;
    g.vy = JUMP;
    g.score = 0;
    g.camY = 0;
    g.facingLeft = false;
    g.platforms = initPlatforms();
    g.monsters = [];
    g.bullets = [];
    g.particles = [];
    g.shootCooldown = 0;
    g.deadTimer = 0;
    g.state = "play";
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      const down = e.type === "keydown";
      if (e.key === "ArrowLeft") { g.keys.left = down; if (down) g.facingLeft = true; }
      if (e.key === "ArrowRight") { g.keys.right = down; if (down) g.facingLeft = false; }
      if (e.key === "ArrowUp" && down) {
        if (g.state !== "play") reset();
        else g.keys.shoot = true;
      }
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") gameRef.current.keys.shoot = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [reset]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    // ---- Draw helpers ----

    const drawGrid = () => {
      ctx.strokeStyle = "rgba(200,220,200,0.35)";
      ctx.lineWidth = 1;
      const offset = (gameRef.current.camY * 0.5) % 24;
      for (let x = 0; x <= W; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = -offset; y <= H; y += 24) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    };

    const drawPlatform = (p: Platform) => {
      const sy = p.y - gameRef.current.camY;
      if (sy > H + 20 || sy < -30) return;

      if (p.broken) {
        if (p.breakAnim <= 0) return;
        ctx.save();
        ctx.globalAlpha = p.breakAnim / 20;
        // two halves flying apart
        const off = (20 - p.breakAnim) * 2;
        ctx.fillStyle = "#cc4400";
        ctx.fillRect(p.x, sy - off, PLAT_W / 2 - 2, PLAT_H);
        ctx.fillRect(p.x + PLAT_W / 2 + 2, sy + off, PLAT_W / 2 - 2, PLAT_H);
        ctx.restore();
        return;
      }

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.ellipse(p.x + PLAT_W / 2, sy + PLAT_H + 3, PLAT_W / 2, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Platform body
      let top = "#76c442", mid = "#5aad2c", bot = "#3d8a1a";
      if (p.type === "blue") { top = "#4ac8e8"; mid = "#29a8cc"; bot = "#1a7a9a"; }
      if (p.type === "brown") { top = "#c47830"; mid = "#a85a18"; bot = "#7a3c08"; }
      if (p.type === "white") { top = "#f0f0f0"; mid = "#d0d0d0"; bot = "#aaaaaa"; }

      const r = 5;
      ctx.beginPath();
      ctx.moveTo(p.x + r, sy);
      ctx.lineTo(p.x + PLAT_W - r, sy);
      ctx.quadraticCurveTo(p.x + PLAT_W, sy, p.x + PLAT_W, sy + r);
      ctx.lineTo(p.x + PLAT_W, sy + PLAT_H - r);
      ctx.quadraticCurveTo(p.x + PLAT_W, sy + PLAT_H, p.x + PLAT_W - r, sy + PLAT_H);
      ctx.lineTo(p.x + r, sy + PLAT_H);
      ctx.quadraticCurveTo(p.x, sy + PLAT_H, p.x, sy + PLAT_H - r);
      ctx.lineTo(p.x, sy + r);
      ctx.quadraticCurveTo(p.x, sy, p.x + r, sy);
      ctx.closePath();
      const grad = ctx.createLinearGradient(p.x, sy, p.x, sy + PLAT_H);
      grad.addColorStop(0, top);
      grad.addColorStop(0.5, mid);
      grad.addColorStop(1, bot);
      ctx.fillStyle = grad;
      ctx.fill();
      // highlight
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(p.x + 6, sy + 2, PLAT_W - 12, 3);

      // Spring
      if (p.spring) {
        const sx2 = p.x + PLAT_W / 2 - 5;
        const sy2 = sy - (p.springAnim > 0 ? 2 : 10);
        ctx.fillStyle = "#e83030";
        ctx.fillRect(sx2, sy2, 10, 10);
        ctx.fillStyle = "#ff8888";
        ctx.fillRect(sx2 + 2, sy2 + 2, 6, 3);
        // coil
        ctx.strokeStyle = "#aaa";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(sx2, sy2 + 10 + i * 3);
          ctx.lineTo(sx2 + 10, sy2 + 10 + i * 3);
          ctx.stroke();
        }
      }
    };

    const drawDoodler = (px: number, py: number, facingLeft: boolean, velY: number) => {
      const sy = py - gameRef.current.camY;
      const cx = px + PLAYER_W / 2;
      const dir = facingLeft ? -1 : 1;

      // Body (green blob)
      ctx.save();
      ctx.fillStyle = "#7cc826";
      ctx.strokeStyle = "#2a6600";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, sy + 14, 14, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Eyes
      const eyeX = cx + dir * 5;
      // white
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(eyeX, sy + 10, 6, 7, dir * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#2a6600";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // pupil
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.ellipse(eyeX + dir * 1.5, sy + 10, 3, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // shine
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(eyeX + dir * 2.5, sy + 8, 1, 0, Math.PI * 2);
      ctx.fill();

      // Nose
      ctx.fillStyle = "#ff9944";
      ctx.beginPath();
      ctx.ellipse(cx + dir * 11, sy + 14, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#cc6600";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Legs/feet
      const legY = sy + 26;
      const legSpread = velY > 0 ? 10 : 6;
      ctx.fillStyle = "#7cc826";
      ctx.strokeStyle = "#2a6600";
      ctx.lineWidth = 1.5;
      // left foot
      ctx.beginPath();
      ctx.ellipse(cx - legSpread, legY, 5, 4, -0.3, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // right foot
      ctx.beginPath();
      ctx.ellipse(cx + legSpread, legY, 5, 4, 0.3, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      ctx.restore();
    };

    const drawMonster = (m: Monster) => {
      const sy = m.y - gameRef.current.camY;
      if (sy > H + 40 || sy < -40) return;
      if (m.dead) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, m.deadAnim / 30);
        ctx.fillStyle = "#999";
        ctx.beginPath();
        ctx.ellipse(m.x + m.w / 2, sy + m.h / 2, m.w / 2 * (1 + (30 - m.deadAnim) / 20), m.h / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      ctx.save();
      // Body
      ctx.fillStyle = "#e03030";
      ctx.strokeStyle = "#800000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(m.x + m.w / 2, sy + m.h / 2 + 4, m.w / 2, m.h / 2, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Eyes (two)
      [-8, 8].forEach(ox => {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(m.x + m.w / 2 + ox, sy + m.h / 2, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#800000"; ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(m.x + m.w / 2 + ox + (m.dx > 0 ? 1 : -1), sy + m.h / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
      // Legs
      ctx.strokeStyle = "#800000"; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i += 2) {
        for (let j = 0; j < 2; j++) {
          ctx.beginPath();
          ctx.moveTo(m.x + m.w / 2 + i * 10, sy + m.h - 4);
          ctx.lineTo(m.x + m.w / 2 + i * 16, sy + m.h + 6 + j * 4);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const drawBullet = (b: Bullet) => {
      const sy = b.y - gameRef.current.camY;
      ctx.save();
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#aaa";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(b.x, sy, 3, 6, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    };

    const drawScore = (score: number, best: number) => {
      ctx.save();
      ctx.font = "bold 15px 'Arial Rounded MT Bold', Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.fillStyle = "#555";
      ctx.fillText(`${score}`, W - 10, 24);
      if (best > 0) {
        ctx.font = "11px Arial, sans-serif";
        ctx.fillStyle = "#aaa";
        ctx.fillText(`Рекорд: ${best}`, W - 10, 42);
      }
      ctx.restore();
    };

    const spawnParticle = (x: number, y: number, color: string) => {
      for (let i = 0; i < 6; i++) {
        gameRef.current.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5 - 2,
          life: 1,
          color,
        });
      }
    };

    const loop = () => {
      const g = gameRef.current;
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = "#f5f5e8";
      ctx.fillRect(0, 0, W, H);
      drawGrid();

      if (g.state === "start") {
        // Title
        ctx.save();
        ctx.font = "bold 28px 'Arial Rounded MT Bold', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#4a8a20";
        ctx.fillText("Doodle Jump", W / 2, H / 2 - 60);
        ctx.font = "14px Arial";
        ctx.fillStyle = "#888";
        ctx.fillText("← → движение, ↑ стрелять", W / 2, H / 2 - 20);
        ctx.font = "bold 16px Arial";
        ctx.fillStyle = "#e05020";
        const pulse = Math.abs(Math.sin(Date.now() / 500));
        ctx.globalAlpha = 0.6 + pulse * 0.4;
        ctx.fillText("Нажми любую стрелку", W / 2, H / 2 + 20);
        ctx.restore();
        drawDoodler(W / 2 - PLAYER_W / 2, H / 2 + 60, false, 0);
        g.frameId = requestAnimationFrame(loop);
        return;
      }

      // --- PLAY ---
      if (g.state === "play") {
        // Input
        if (g.keys.left) { g.vx = -SPEED; g.facingLeft = true; }
        else if (g.keys.right) { g.vx = SPEED; g.facingLeft = false; }
        else g.vx *= 0.75;

        // Shoot
        if (g.keys.shoot && g.shootCooldown <= 0) {
          g.bullets.push({ x: g.px + PLAYER_W / 2, y: g.py + g.camY });
          g.shootCooldown = 25;
          g.keys.shoot = false;
        }
        if (g.shootCooldown > 0) g.shootCooldown--;

        // Physics
        g.vy += GRAVITY;
        g.px += g.vx;
        g.py += g.vy;

        // Wrap
        if (g.px + PLAYER_W < 0) g.px = W;
        if (g.px > W) g.px = -PLAYER_W;

        // Camera
        const threshold = H * 0.4;
        const pScreen = g.py - g.camY;
        if (pScreen < threshold) {
          const d = threshold - pScreen;
          g.camY -= d;
          g.score = Math.max(g.score, Math.floor(-g.camY / 8));
        }

        // Platform collision (only falling down)
        if (g.vy > 0) {
          for (const p of g.platforms) {
            if (p.broken) continue;
            const sy = p.y - g.camY;
            const footY = g.py + PLAYER_H - g.camY;
            const prevFoot = footY - g.vy;
            if (
              g.px + 4 < p.x + PLAT_W &&
              g.px + PLAYER_W - 4 > p.x &&
              prevFoot <= sy + 2 &&
              footY >= sy &&
              footY <= sy + PLAT_H + 6
            ) {
              if (p.type === "brown") {
                p.broken = true;
                p.breakAnim = 20;
                spawnParticle(p.x + PLAT_W / 2, p.y - g.camY, "#c47830");
              } else {
                if (p.spring) {
                  g.vy = JUMP * 2.2;
                  p.springAnim = 10;
                  spawnParticle(p.x + PLAT_W / 2, p.y - g.camY, "#e83030");
                } else {
                  g.vy = JUMP;
                }
              }
            }
          }
        }

        // Moving platforms
        for (const p of g.platforms) {
          if (p.type === "blue") {
            p.x += p.dx;
            if (p.x < 0 || p.x > W - PLAT_W) p.dx = -p.dx;
          }
          if (p.breakAnim > 0) p.breakAnim--;
          if (p.springAnim > 0) p.springAnim--;
        }

        // Generate platforms
        const topP = g.platforms.reduce((a, b) => a.y < b.y ? a : b);
        const gap = Math.min(60 + g.score / 200, 90);
        if (topP.y - g.camY > -H) {
          g.platforms.push(makePlatform(Math.random() * (W - PLAT_W), topP.y - gap, g.score));
        }
        g.platforms = g.platforms.filter(p => p.y - g.camY < H + 50 || p.breakAnim > 0);

        // Spawn monsters
        if (g.score > 500 && Math.random() < 0.003 + g.score / 500000) {
          g.monsters.push({
            x: Math.random() < 0.5 ? 0 : W - 40,
            y: g.camY + 60,
            w: 40, h: 32,
            dx: (Math.random() * 1 + 0.8) * (Math.random() < 0.5 ? 1 : -1),
            dead: false,
            deadAnim: 30,
          });
        }

        // Monsters
        for (const m of g.monsters) {
          if (m.dead) { m.deadAnim--; continue; }
          m.x += m.dx;
          if (m.x < 0 || m.x + m.w > W) m.dx = -m.dx;
          // Player stomps monster from above
          const msy = m.y - g.camY;
          if (
            g.px + 4 < m.x + m.w &&
            g.px + PLAYER_W - 4 > m.x &&
            g.py + PLAYER_H - g.camY > msy &&
            g.py + PLAYER_H - g.camY < msy + m.h + 10 &&
            g.vy > 0
          ) {
            m.dead = true;
            g.vy = JUMP;
            g.score += 100;
            spawnParticle(m.x + m.w / 2, msy, "#e03030");
          }
          // Player touched monster (death)
          if (
            !m.dead &&
            g.px + 6 < m.x + m.w &&
            g.px + PLAYER_W - 6 > m.x &&
            g.py - g.camY + 4 < msy + m.h &&
            g.py + PLAYER_H - g.camY - 4 > msy
          ) {
            g.state = "dead";
            g.best = Math.max(g.best, g.score);
          }
        }
        g.monsters = g.monsters.filter(m => !m.dead || m.deadAnim > 0);

        // Bullets
        for (const b of g.bullets) b.y -= 12;
        // Bullet-monster collision
        for (const b of g.bullets) {
          for (const m of g.monsters) {
            if (m.dead) continue;
            const msy = m.y - g.camY;
            const bsy = b.y - g.camY;
            if (b.x > m.x && b.x < m.x + m.w && bsy > msy && bsy < msy + m.h) {
              m.dead = true;
              g.score += 100;
              spawnParticle(m.x + m.w / 2, msy, "#e03030");
            }
          }
        }
        g.bullets = g.bullets.filter(b => b.y - g.camY > -50);

        // Particles
        for (const p of g.particles) {
          p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.04;
        }
        g.particles = g.particles.filter(p => p.life > 0);

        // Death by falling
        if (g.py - g.camY > H + 60) {
          g.state = "dead";
          g.best = Math.max(g.best, g.score);
        }
      }

      if (g.state === "dead") {
        g.deadTimer++;
      }

      // --- DRAW ---
      for (const p of g.platforms) drawPlatform(p);
      for (const m of g.monsters) drawMonster(m);
      for (const b of g.bullets) drawBullet(b);

      // Particles
      for (const p of g.particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y - g.camY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (g.state !== "start") {
        drawDoodler(g.px, g.py, g.facingLeft, g.vy);
      }

      drawScore(g.score, g.best);

      // Dead overlay
      if (g.state === "dead") {
        ctx.fillStyle = "rgba(255,255,240,0.7)";
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.textAlign = "center";
        ctx.font = "bold 30px 'Arial Rounded MT Bold', Arial, sans-serif";
        ctx.fillStyle = "#e03020";
        ctx.fillText("Game Over", W / 2, H / 2 - 40);
        ctx.font = "bold 20px Arial";
        ctx.fillStyle = "#4a8a20";
        ctx.fillText(`Счёт: ${g.score}`, W / 2, H / 2);
        if (g.score === g.best && g.best > 0) {
          ctx.font = "14px Arial";
          ctx.fillStyle = "#e8a020";
          ctx.fillText("Новый рекорд!", W / 2, H / 2 + 28);
        }
        const pulse = Math.abs(Math.sin(Date.now() / 500));
        ctx.globalAlpha = 0.6 + pulse * 0.4;
        ctx.font = "bold 15px Arial";
        ctx.fillStyle = "#e03020";
        ctx.fillText("Нажми ↑ для рестарта", W / 2, H / 2 + 62);
        ctx.restore();
      }

      g.frameId = requestAnimationFrame(loop);
    };

    const g = gameRef.current;
    g.platforms = initPlatforms();
    g.frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(g.frameId);
  }, [reset]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "#111",
    }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          display: "block",
          borderRadius: "12px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
          cursor: "none",
        }}
      />
      <div style={{
        color: "rgba(255,255,255,0.3)",
        fontSize: "12px",
        marginTop: "14px",
        fontFamily: "Arial, sans-serif",
        letterSpacing: "1px",
      }}>
        ← → ДВИЖЕНИЕ &nbsp;·&nbsp; ↑ СТРЕЛЯТЬ
      </div>
    </div>
  );
}
