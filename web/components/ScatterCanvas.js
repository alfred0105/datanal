"use client";
import { useRef, useEffect } from "react";
import { pearson, mean, std } from "../lib/analysis";

/**
 * Canvas 산점도 컴포넌트
 * props: { xVar, yVar, cases, width, height }
 */
export default function ScatterCanvas({ xVar, yVar, cases, width = 480, height = 360 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !xVar || !yVar || !cases.length) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const pad = { top: 24, right: 24, bottom: 44, left: 52 };
    const pw = width - pad.left - pad.right;
    const ph = height - pad.top - pad.bottom;

    // 데이터
    const pts = cases
      .map((c) => ({ x: c.vals[xVar], y: c.vals[yVar], ok: c.result === "성공" }))
      .filter((p) => p.x != null && p.y != null);

    if (!pts.length) {
      ctx.fillStyle = "#0a0c18";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#5c6490";
      ctx.font = "13px Inter";
      ctx.textAlign = "center";
      ctx.fillText("데이터 없음", width / 2, height / 2);
      return;
    }

    const xMin = Math.min(...pts.map((p) => p.x));
    const xMax = Math.max(...pts.map((p) => p.x));
    const yMin = Math.min(...pts.map((p) => p.y));
    const yMax = Math.max(...pts.map((p) => p.y));
    const xRng = xMax - xMin || 1;
    const yRng = yMax - yMin || 1;

    const tx = (v) => pad.left + ((v - xMin) / xRng) * pw;
    const ty = (v) => pad.top + ph - ((v - yMin) / yRng) * ph;

    // 배경
    ctx.fillStyle = "#0a0c18";
    ctx.fillRect(0, 0, width, height);

    // 그리드
    ctx.strokeStyle = "#1e2240";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const gx = pad.left + (pw * i) / 4;
      const gy = pad.top + (ph * i) / 4;
      ctx.beginPath(); ctx.moveTo(gx, pad.top); ctx.lineTo(gx, pad.top + ph); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(pad.left + pw, gy); ctx.stroke();

      ctx.fillStyle = "#5c6490";
      ctx.font = "9px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText((xMin + (xRng * i) / 4).toFixed(1), gx, height - pad.bottom + 14);
      ctx.textAlign = "right";
      ctx.fillText((yMax - (yRng * i) / 4).toFixed(1), pad.left - 6, gy + 3);
    }

    // 축 라벨
    ctx.fillStyle = "#7080b8";
    ctx.font = "11px Inter";
    ctx.textAlign = "center";
    ctx.fillText(xVar, pad.left + pw / 2, height - 4);
    ctx.save();
    ctx.translate(12, pad.top + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yVar, 0, 0);
    ctx.restore();

    // 실패 점
    for (const p of pts.filter((p) => !p.ok)) {
      ctx.beginPath();
      ctx.arc(tx(p.x), ty(p.y), 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(239,68,68,0.45)";
      ctx.fill();
      ctx.strokeStyle = "rgba(153,27,27,0.5)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    // 성공 점
    for (const p of pts.filter((p) => p.ok)) {
      ctx.beginPath();
      ctx.arc(tx(p.x), ty(p.y), 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(59,130,246,0.55)";
      ctx.fill();
      ctx.strokeStyle = "rgba(29,78,216,0.5)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    // 추세선
    if (pts.length >= 3) {
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const n = xs.length;
      const sx = xs.reduce((a, b) => a + b, 0);
      const sy = ys.reduce((a, b) => a + b, 0);
      const sxy = xs.reduce((a, v, i) => a + v * ys[i], 0);
      const sx2 = xs.reduce((a, v) => a + v * v, 0);
      const denom = n * sx2 - sx * sx;
      if (Math.abs(denom) > 1e-12) {
        const slope = (n * sxy - sx * sy) / denom;
        const intercept = (sy - slope * sx) / n;
        ctx.beginPath();
        ctx.moveTo(tx(xMin), ty(slope * xMin + intercept));
        ctx.lineTo(tx(xMax), ty(slope * xMax + intercept));
        ctx.strokeStyle = "rgba(251,191,36,0.6)";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 범례
    const lx = pad.left + pw - 90, ly = pad.top + 8;
    ctx.fillStyle = "rgba(17,20,37,0.85)";
    ctx.fillRect(lx - 6, ly - 4, 100, 42);
    ctx.fillStyle = "rgba(59,130,246,0.7)";
    ctx.beginPath(); ctx.arc(lx, ly + 6, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c0c8f0";
    ctx.font = "10px Inter";
    ctx.textAlign = "left";
    ctx.fillText("성공", lx + 8, ly + 9);
    ctx.fillStyle = "rgba(239,68,68,0.6)";
    ctx.beginPath(); ctx.arc(lx, ly + 20, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c0c8f0";
    ctx.fillText("실패", lx + 8, ly + 23);
    ctx.strokeStyle = "rgba(251,191,36,0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(lx - 4, ly + 34); ctx.lineTo(lx + 4, ly + 34); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#c0c8f0";
    ctx.fillText("추세선", lx + 8, ly + 37);

  }, [xVar, yVar, cases, width, height]);

  return <canvas ref={ref} style={{ borderRadius: 10, border: "1px solid rgba(79,142,247,.12)" }} />;
}
