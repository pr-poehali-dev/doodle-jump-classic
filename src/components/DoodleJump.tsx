import { useEffect, useRef, useState, useCallback } from "react";

const CANVAS_W = 400;
const CANVAS_H = 600;
const PLAYER_W = 34;
const PLAYER_H = 34;
const PLATFORM_W = 70;
const PLATFORM_H = 12;
const GRAVITY = 0.35;
const JUMP_FORCE = -10.5;
const MOVE_SPEED = 5;
const PLATFORM_COUNT = 12;

interface Platform {
  x: number;
  y: number;
  type: "normal" | "moving" | "crumble";
  dx?: number;
  broken?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

function generatePlatforms(startY: number): Platform[] {
  const platforms: Platform[] = [];
  for (let i = 0; i < PLATFORM_COUNT; i++) {
    const y = startY - i * (CANVAS_H / PLATFORM_COUNT);
    const type: Platform["type"] =
      i > 5 && Math.random() < 0.25
        ? "moving"
        : i > 8 && Math.random() < 0.2
        ? "crumble"
        : "normal";
    platforms.push({
      x: Math.random() * (CANVAS_W - PLATFORM_W),
      y,
      type,
      dx: type === "moving" ? (Math.random() > 0.5 ? 1.5 : -1.5) : 0,
    });
  }
  return platforms;
}

export default function DoodleJump() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    playerX: CANVAS_W / 2 - PLAYER_W / 2,
    playerY: CANVAS_H - 120,
    velX: 0,
    velY: JUMP_FORCE,
    score: 0,
    highScore: 0,
    cameraY: 0,
    platforms: [] as Platform[],
    particles: [] as Particle[],
    keys: { left: false, right: false },
    gameOver: false,
    started: false,
    frameId: 0,
    eyeDir: 0,
    jumpFlash: 0,
  });
  const [displayScore, setDisplayScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const initGame = useCallback(() => {
    const s = stateRef.current;
    s.platforms = generatePlatforms(CANVAS_H - 80);
    s.platforms[0] = { x: CANVAS_W / 2 - PLATFORM_W / 2, y: CANVAS_H - 80, type: "normal" };
    s.playerX = CANVAS_W / 2 - PLAYER_W / 2;
    s.playerY = CANVAS_H - 120;
    s.velX = 0;
    s.velY = JUMP_FORCE;
    s.score = 0;
    s.cameraY = 0;
    s.gameOver = false;
    s.started = true;
    s.particles = [];
    s.jumpFlash = 0;
    setDisplayScore(0);
    setGameOver(false);
    setStarted(true);
  }, []);

  const spawnParticles = (x: number, y: number, color: string) => {
    const s = stateRef.current;
    for (let i = 0; i < 8; i++) {
      s.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2,
        life: 1,
        color,
      });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      const down = e.type === "keydown";
      if (e.key === "ArrowLeft") s.keys.left = down;
      if (e.key === "ArrowRight") s.keys.right = down;
      if ((e.key === "ArrowUp" || e.key === " " || e.key === "Enter") && down) {
        if (!s.started || s.gameOver) initGame();
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === " " || e.key === "ArrowUp") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [initGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const drawPlayer = (x: number, y: number, eyeDir: number, jumping: boolean) => {
      const cx = x + PLAYER_W / 2;
      const cy = y + PLAYER_H / 2;

      // Body glow
      const grd = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
      grd.addColorStop(0, "rgba(100,255,180,0.18)");
      grd.addColorStop(1, "rgba(100,255,180,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.save();
      ctx.shadowColor = "#4fffb0";
      ctx.shadowBlur = 12;
      ctx.fillStyle = jumping ? "#5fffb8" : "#3de89a";
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Inner circle
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      const ex = cx + eyeDir * 5;
      ctx.fillStyle = "#4fffb0";
      ctx.beginPath();
      ctx.arc(ex, cy - 2, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(ex + 0.5, cy - 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawPlatform = (p: Platform, camY: number) => {
      const screenY = p.y - camY;
      if (screenY > CANVAS_H + 20 || screenY < -20) return;

      ctx.save();

      if (p.type === "normal") {
        ctx.shadowColor = "#4fffb0";
        ctx.shadowBlur = 8;
        const gr = ctx.createLinearGradient(p.x, screenY, p.x, screenY + PLATFORM_H);
        gr.addColorStop(0, "#3de89a");
        gr.addColorStop(1, "#1a8a5a");
        ctx.fillStyle = gr;
      } else if (p.type === "moving") {
        ctx.shadowColor = "#b0aaff";
        ctx.shadowBlur = 8;
        const gr = ctx.createLinearGradient(p.x, screenY, p.x, screenY + PLATFORM_H);
        gr.addColorStop(0, "#a0a0ff");
        gr.addColorStop(1, "#5050cc");
        ctx.fillStyle = gr;
      } else {
        ctx.shadowColor = p.broken ? "#ff4444" : "#ffaa44";
        ctx.shadowBlur = 8;
        const gr = ctx.createLinearGradient(p.x, screenY, p.x, screenY + PLATFORM_H);
        gr.addColorStop(0, p.broken ? "#ff4444" : "#ffaa44");
        gr.addColorStop(1, p.broken ? "#990000" : "#cc6600");
        ctx.fillStyle = gr;
      }

      drawRoundRect(p.x, screenY, PLATFORM_W, PLATFORM_H, 6);
      ctx.fill();

      // Highlight
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      drawRoundRect(p.x + 4, screenY + 2, PLATFORM_W - 8, 3, 2);
      ctx.fill();

      ctx.restore();
    };

    const loop = () => {
      const s = stateRef.current;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Background
      ctx.fillStyle = "#080808";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Stars
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      const seed = Math.floor(s.cameraY / 100);
      for (let i = 0; i < 40; i++) {
        const sx = ((seed * 137 + i * 73) % CANVAS_W);
        const sy = ((seed * 89 + i * 53) % CANVAS_H);
        const r = (i % 3 === 0) ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!s.started) {
        // Start screen
        ctx.save();
        const pulse = Math.sin(Date.now() / 600) * 0.15 + 0.85;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "#4fffb0";
        ctx.font = "bold 18px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.shadowColor = "#4fffb0";
        ctx.shadowBlur = 20;
        ctx.fillText("НАЖМИ ↑ ЧТОБЫ НАЧАТЬ", CANVAS_W / 2, CANVAS_H / 2);
        ctx.restore();

        // Draw idle player
        drawPlayer(CANVAS_W / 2 - PLAYER_W / 2, CANVAS_H / 2 - 80, 0, false);
        s.frameId = requestAnimationFrame(loop);
        return;
      }

      if (!s.gameOver) {
        // Input
        if (s.keys.left) { s.velX = -MOVE_SPEED; s.eyeDir = -1; }
        else if (s.keys.right) { s.velX = MOVE_SPEED; s.eyeDir = 1; }
        else { s.velX *= 0.85; }

        // Physics
        s.velY += GRAVITY;
        s.playerX += s.velX;
        s.playerY += s.velY;

        // Wrap
        if (s.playerX > CANVAS_W) s.playerX = -PLAYER_W;
        if (s.playerX < -PLAYER_W) s.playerX = CANVAS_W;

        // Camera
        const threshold = CANVAS_H * 0.4;
        const playerScreen = s.playerY - s.cameraY;
        if (playerScreen < threshold) {
          const delta = threshold - playerScreen;
          s.cameraY -= delta;
          s.score = Math.max(s.score, Math.floor(-s.cameraY / 10));
          setDisplayScore(s.score);
        }

        // Platform collision
        if (s.velY > 0) {
          for (const p of s.platforms) {
            if (p.broken) continue;
            const screenY = p.y - s.cameraY;
            const px = s.playerX + 4;
            const py = s.playerY + PLAYER_H;
            const prevPy = py - s.velY;
            if (
              px + PLAYER_W - 8 > p.x &&
              px < p.x + PLATFORM_W &&
              prevPy <= p.y - s.cameraY + 2 &&
              py >= screenY &&
              py <= screenY + PLATFORM_H + 8
            ) {
              if (p.type === "crumble") {
                p.broken = true;
                spawnParticles(p.x + PLATFORM_W / 2, p.y - s.cameraY, "#ffaa44");
                setTimeout(() => { p.broken = true; }, 200);
              }
              s.velY = JUMP_FORCE;
              s.jumpFlash = 8;
              spawnParticles(s.playerX + PLAYER_W / 2, s.playerY + PLAYER_H, "#4fffb0");
            }
          }
        }

        // Moving platforms
        for (const p of s.platforms) {
          if (p.type === "moving" && p.dx) {
            p.x += p.dx;
            if (p.x < 0 || p.x > CANVAS_W - PLATFORM_W) p.dx = -p.dx;
          }
        }

        // Generate new platforms
        const topPlatform = s.platforms.reduce((a, b) => (a.y < b.y ? a : b));
        if (topPlatform.y - s.cameraY > -CANVAS_H) {
          const type: Platform["type"] =
            s.score > 300 && Math.random() < 0.3
              ? "moving"
              : s.score > 500 && Math.random() < 0.2
              ? "crumble"
              : "normal";
          s.platforms.push({
            x: Math.random() * (CANVAS_W - PLATFORM_W),
            y: topPlatform.y - CANVAS_H / PLATFORM_COUNT,
            type,
            dx: type === "moving" ? (Math.random() > 0.5 ? 1.8 : -1.8) : 0,
          });
        }

        // Remove old platforms
        s.platforms = s.platforms.filter((p) => p.y - s.cameraY < CANVAS_H + 50);

        // Game over
        if (s.playerY - s.cameraY > CANVAS_H + 40) {
          s.gameOver = true;
          s.highScore = Math.max(s.highScore, s.score);
          setGameOver(true);
        }

        // Particles
        s.particles = s.particles.filter((p) => p.life > 0);
        for (const p of s.particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.1;
          p.life -= 0.05;
        }
      }

      // Draw platforms
      for (const p of s.platforms) drawPlatform(p, s.cameraY);

      // Draw particles
      for (const p of s.particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y - s.cameraY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Jump flash
      if (s.jumpFlash > 0) {
        ctx.save();
        ctx.globalAlpha = s.jumpFlash / 8 * 0.08;
        ctx.fillStyle = "#4fffb0";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.restore();
        s.jumpFlash--;
      }

      // Draw player
      const jumping = s.velY < 0;
      drawPlayer(s.playerX, s.playerY - s.cameraY, s.eyeDir, jumping);

      // Score
      ctx.save();
      ctx.font = "bold 16px 'Courier New', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.textAlign = "left";
      ctx.fillText(`${s.score}`, 16, 28);
      if (s.highScore > 0) {
        ctx.fillStyle = "rgba(100,255,180,0.4)";
        ctx.fillText(`Рекорд: ${s.highScore}`, 16, 48);
      }
      ctx.restore();

      // Game over overlay
      if (s.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        ctx.save();
        ctx.textAlign = "center";
        ctx.shadowColor = "#ff4444";
        ctx.shadowBlur = 30;
        ctx.fillStyle = "#ff6666";
        ctx.font = "bold 36px 'Courier New', monospace";
        ctx.fillText("ИГРА ОКОНЧЕНА", CANVAS_W / 2, CANVAS_H / 2 - 40);

        ctx.shadowColor = "#4fffb0";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#4fffb0";
        ctx.font = "bold 24px 'Courier New', monospace";
        ctx.fillText(`Счёт: ${s.score}`, CANVAS_W / 2, CANVAS_H / 2 + 10);

        const pulse = Math.sin(Date.now() / 500) * 0.2 + 0.8;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "14px 'Courier New', monospace";
        ctx.fillText("Нажми ↑ для рестарта", CANVAS_W / 2, CANVAS_H / 2 + 60);
        ctx.restore();
      }

      s.frameId = requestAnimationFrame(loop);
    };

    s.frameId = requestAnimationFrame(loop);
    const s = stateRef.current;

    return () => cancelAnimationFrame(s.frameId);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <div
        style={{
          position: "relative",
          boxShadow: "0 0 60px rgba(79,255,176,0.15), 0 0 120px rgba(79,255,176,0.05)",
          borderRadius: "8px",
          border: "1px solid rgba(79,255,176,0.15)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: "block", borderRadius: "8px" }}
        />
      </div>
      <p
        style={{
          color: "rgba(79,255,176,0.3)",
          fontSize: "12px",
          marginTop: "16px",
          fontFamily: "'Courier New', monospace",
          letterSpacing: "2px",
        }}
      >
        ← → ДВИЖЕНИЕ
      </p>
    </div>
  );
}
