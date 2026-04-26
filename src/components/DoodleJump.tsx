import { useEffect, useRef, useCallback } from "react";

const W = 300;
const H = 500;
const GRAVITY = 0.3;
const JUMP = -10;
const PLAYER_W = 40;
const PLAYER_H = 46;
const PLAT_W = 58;
const PLAT_H = 11;
const SPEED = 4.5;

interface Platform {
  x: number;
  y: number;
  type: "green" | "blue" | "brown";
  dx: number;
  broken: boolean;
  breakAnim: number;
  spring: boolean;
  springAnim: number;
}

function makePlatform(x: number, y: number, score: number): Platform {
  const r = Math.random();
  let type: Platform["type"] = "green";
  if (score > 2000 && r < 0.08) type = "brown";
  else if (score > 500 && r < 0.18) type = "blue";
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
    camY: 0,
    platforms: [] as Platform[],
    keys: { left: false, right: false },
    state: "start" as "start" | "play" | "dead",
    deadTimer: 0,
    frameId: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
  });

  const initPlatforms = () => {
    const platforms: Platform[] = [];
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
    g.particles = [];
    g.deadTimer = 0;
    g.state = "play";
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      const down = e.type === "keydown";
      if (e.key === "ArrowLeft") { g.keys.left = down; if (down) g.facingLeft = true; }
      if (e.key === "ArrowRight") { g.keys.right = down; if (down) g.facingLeft = false; }
      if (down && (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        if (g.state !== "play") reset();
      }
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [reset]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const drawGrid = () => {
      ctx.strokeStyle = "rgba(180,210,180,0.3)";
      ctx.lineWidth = 1;
      const offset = (gameRef.current.camY * 0.5) % 24;
      for (let x = 0; x <= W; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = -offset; y <= H; y += 24) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    };

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
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

    const drawPlatform = (p: Platform) => {
      const sy = p.y - gameRef.current.camY;
      if (sy > H + 20 || sy < -30) return;

      if (p.broken) {
        if (p.breakAnim <= 0) return;
        ctx.save();
        ctx.globalAlpha = p.breakAnim / 20;
        const off = (20 - p.breakAnim) * 2;
        ctx.fillStyle = "#b85010";
        ctx.fillRect(p.x, sy - off, PLAT_W / 2 - 2, PLAT_H);
        ctx.fillRect(p.x + PLAT_W / 2 + 2, sy + off, PLAT_W / 2 - 2, PLAT_H);
        ctx.restore();
        return;
      }

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.beginPath();
      ctx.ellipse(p.x + PLAT_W / 2, sy + PLAT_H + 3, PLAT_W / 2, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      let top = "#76c442", mid = "#5aad2c", bot = "#3d8a1a";
      if (p.type === "blue")  { top = "#4ac8e8"; mid = "#29a8cc"; bot = "#1a7a9a"; }
      if (p.type === "brown") { top = "#c47830"; mid = "#a85a18"; bot = "#7a3c08"; }

      roundRect(p.x, sy, PLAT_W, PLAT_H, 5);
      const grad = ctx.createLinearGradient(p.x, sy, p.x, sy + PLAT_H);
      grad.addColorStop(0, top); grad.addColorStop(0.5, mid); grad.addColorStop(1, bot);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.fillRect(p.x + 6, sy + 2, PLAT_W - 12, 3);

      // Spring — жёлто-оранжевая спираль как в оригинале
      if (p.spring) {
        const sx = p.x + PLAT_W / 2;
        const compressed = p.springAnim > 0;
        const baseY = sy;
        const springH = compressed ? 6 : 14;
        const coils = 4;

        // Основание пружины
        ctx.fillStyle = "#f0b000";
        ctx.strokeStyle = "#c07800";
        ctx.lineWidth = 1;
        roundRect(sx - 7, baseY - 4, 14, 5, 2);
        ctx.fill(); ctx.stroke();

        // Витки
        ctx.strokeStyle = "#f5c400";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        const coilH = springH / coils;
        for (let i = 0; i < coils; i++) {
          const y1 = baseY - 4 - i * coilH;
          const y2 = baseY - 4 - (i + 0.5) * coilH;
          ctx.beginPath();
          ctx.moveTo(sx - 6, y1);
          ctx.lineTo(sx + 6, y2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sx + 6, y2);
          ctx.lineTo(sx - 6, y1 - coilH);
          ctx.stroke();
        }

        // Шляпка
        ctx.fillStyle = "#f5c400";
        ctx.strokeStyle = "#c07800";
        ctx.lineWidth = 1;
        roundRect(sx - 8, baseY - 4 - springH - 4, 16, 5, 2);
        ctx.fill(); ctx.stroke();
      }
    };

    const drawDoodler = (px: number, py: number, facingLeft: boolean) => {
      const sy = py - gameRef.current.camY;
      const cx = px + PLAYER_W / 2;
      const dir = facingLeft ? -1 : 1;
      ctx.save();

      // Тело — жёлтая груша
      ctx.fillStyle = "#c8c01a";
      ctx.strokeStyle = "#7a7200";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, sy + 2);
      ctx.bezierCurveTo(cx + 13, sy + 2,  cx + 17, sy + 14, cx + 16, sy + 28);
      ctx.bezierCurveTo(cx + 15, sy + 38, cx - 15, sy + 38, cx - 16, sy + 28);
      ctx.bezierCurveTo(cx - 17, sy + 14, cx - 13, sy + 2,  cx, sy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Три чёрные полосы на брюхе
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, sy + 2);
      ctx.bezierCurveTo(cx + 13, sy + 2,  cx + 17, sy + 14, cx + 16, sy + 28);
      ctx.bezierCurveTo(cx + 15, sy + 38, cx - 15, sy + 38, cx - 16, sy + 28);
      ctx.bezierCurveTo(cx - 17, sy + 14, cx - 13, sy + 2,  cx, sy + 2);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = "#3a3800";
      ctx.fillRect(cx - 18, sy + 20, 36, 3);
      ctx.fillRect(cx - 18, sy + 26, 36, 3);
      ctx.fillRect(cx - 18, sy + 32, 36, 3);
      ctx.restore();

      // Зелёная шапка — поля
      ctx.fillStyle = "#2a7a10";
      ctx.strokeStyle = "#1a4a08";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, sy + 4, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // купол
      ctx.fillStyle = "#50cc22";
      ctx.strokeStyle = "#1a4a08";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, sy - 4, 12, 9, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // тёмный ободок
      ctx.fillStyle = "#1a5a0a";
      ctx.beginPath();
      ctx.ellipse(cx, sy + 2, 12, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Большой глаз
      const eyeX = cx + dir * 4;
      const eyeY = sy + 14;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#7a7200";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, 6.5, 7.5, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.ellipse(eyeX + dir * 2, eyeY + 1, 3.2, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(eyeX + dir * 3, eyeY - 1, 1.1, 0, Math.PI * 2);
      ctx.fill();

      // Клюв
      const bx = cx + dir * 12;
      const by = eyeY + 4;
      ctx.fillStyle = "#d05810";
      ctx.strokeStyle = "#804000";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, by - 3);
      ctx.lineTo(bx + dir * 8, by + 1);
      ctx.lineTo(bx, by + 4);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#804000";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(bx, by + 0.5);
      ctx.lineTo(bx + dir * 7, by + 0.5);
      ctx.stroke();

      // Лапки
      ctx.fillStyle = "#b0a810";
      ctx.strokeStyle = "#7a7200";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx - 11, sy + 40, 6, 4, -0.4, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx + 11, sy + 40, 6, 4, 0.4, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      ctx.restore();
    };

    const spawnParticle = (x: number, y: number, color: string) => {
      for (let i = 0; i < 6; i++) {
        gameRef.current.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5 - 2,
          life: 1, color,
        });
      }
    };

    const loop = () => {
      const g = gameRef.current;
      ctx.clearRect(0, 0, W, H);

      // Фон
      ctx.fillStyle = "#f5f5e8";
      ctx.fillRect(0, 0, W, H);
      drawGrid();

      if (g.state === "start") {
        ctx.save();
        ctx.font = "bold 26px 'Arial Rounded MT Bold', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#4a8a20";
        ctx.fillText("Doodle Jump", W / 2, H / 2 - 70);
        ctx.font = "13px Arial";
        ctx.fillStyle = "#888";
        ctx.fillText("← → для движения", W / 2, H / 2 - 35);
        const pulse = Math.abs(Math.sin(Date.now() / 500));
        ctx.globalAlpha = 0.6 + pulse * 0.4;
        ctx.font = "bold 15px Arial";
        ctx.fillStyle = "#e05020";
        ctx.fillText("Нажми стрелку чтобы начать", W / 2, H / 2 - 10);
        ctx.restore();
        drawDoodler(W / 2 - PLAYER_W / 2, H / 2 + 40, false);
        g.frameId = requestAnimationFrame(loop);
        return;
      }

      if (g.state === "play") {
        if (g.keys.left) { g.vx = -SPEED; g.facingLeft = true; }
        else if (g.keys.right) { g.vx = SPEED; g.facingLeft = false; }
        else g.vx *= 0.75;

        g.vy += GRAVITY;
        g.px += g.vx;
        g.py += g.vy;

        if (g.px + PLAYER_W < 0) g.px = W;
        if (g.px > W) g.px = -PLAYER_W;

        const threshold = H * 0.4;
        const pScreen = g.py - g.camY;
        if (pScreen < threshold) {
          const d = threshold - pScreen;
          g.camY -= d;
          g.score = Math.max(g.score, Math.floor(-g.camY / 8));
        }

        if (g.vy > 0) {
          for (const p of g.platforms) {
            if (p.broken) continue;
            const sy = p.y - g.camY;
            const footY = g.py + PLAYER_H - g.camY;
            const prevFoot = footY - g.vy;
            if (
              g.px + 6 < p.x + PLAT_W &&
              g.px + PLAYER_W - 6 > p.x &&
              prevFoot <= sy + 2 &&
              footY >= sy &&
              footY <= sy + PLAT_H + 6
            ) {
              if (p.type === "brown") {
                p.broken = true;
                p.breakAnim = 20;
                spawnParticle(p.x + PLAT_W / 2, p.y - g.camY, "#c47830");
              } else if (p.spring) {
                g.vy = JUMP * 2.2;
                p.springAnim = 10;
                spawnParticle(p.x + PLAT_W / 2, p.y - g.camY, "#f5c400");
              } else {
                g.vy = JUMP;
              }
            }
          }
        }

        for (const p of g.platforms) {
          if (p.type === "blue") {
            p.x += p.dx;
            if (p.x < 0 || p.x > W - PLAT_W) p.dx = -p.dx;
          }
          if (p.breakAnim > 0) p.breakAnim--;
          if (p.springAnim > 0) p.springAnim--;
        }

        const topP = g.platforms.reduce((a, b) => a.y < b.y ? a : b);
        const gap = Math.min(55 + g.score / 200, 85);
        if (topP.y - g.camY > -H) {
          g.platforms.push(makePlatform(Math.random() * (W - PLAT_W), topP.y - gap, g.score));
        }
        g.platforms = g.platforms.filter(p => p.y - g.camY < H + 50 || p.breakAnim > 0);

        for (const p of g.particles) {
          p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.04;
        }
        g.particles = g.particles.filter(p => p.life > 0);

        if (g.py - g.camY > H + 60) {
          g.state = "dead";
        }
      }

      if (g.state === "dead") g.deadTimer++;

      // Draw
      for (const p of g.platforms) drawPlatform(p);

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
        drawDoodler(g.px, g.py, g.facingLeft);
      }

      // Счёт
      ctx.save();
      ctx.font = "bold 15px 'Arial Rounded MT Bold', Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.fillStyle = "#777";
      ctx.fillText(`${g.score}`, W - 10, 24);
      ctx.restore();

      if (g.state === "dead") {
        ctx.fillStyle = "rgba(245,245,232,0.78)";
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.textAlign = "center";
        ctx.font = "bold 30px 'Arial Rounded MT Bold', Arial, sans-serif";
        ctx.fillStyle = "#e03020";
        ctx.fillText("Game Over", W / 2, H / 2 - 30);
        ctx.font = "bold 20px Arial";
        ctx.fillStyle = "#4a8a20";
        ctx.fillText(`Счёт: ${g.score}`, W / 2, H / 2 + 10);
        const pulse = Math.abs(Math.sin(Date.now() / 500));
        ctx.globalAlpha = 0.6 + pulse * 0.4;
        ctx.font = "bold 14px Arial";
        ctx.fillStyle = "#e03020";
        ctx.fillText("Нажми стрелку для рестарта", W / 2, H / 2 + 52);
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
        }}
      />
      <div style={{
        color: "rgba(255,255,255,0.25)",
        fontSize: "12px",
        marginTop: "14px",
        fontFamily: "Arial, sans-serif",
        letterSpacing: "1px",
      }}>
        ← → ДВИЖЕНИЕ
      </div>
    </div>
  );
}