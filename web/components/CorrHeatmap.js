"use client";
import { useRef, useEffect } from "react";

/**
 * Canvas 상관행렬 히트맵
 * props: { vars: string[], matrix: number[][], size }
 */
export default function CorrHeatmap({ vars, matrix, size = 400 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !vars.length || !matrix.length) return;

    const n = vars.length;
    const dpr = window.devicePixelRatio || 1;
    const pad = { top: 8, right: 8, bottom: 60, left: 70 };
    const w = size, h = size;
    const cellW = (w - pad.left - pad.right) / n;
    const cellH = (h - pad.top - pad.bottom) / n;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // 배경
    ctx.fillStyle = "#0a0c18";
    ctx.fillRect(0, 0, w, h);

    // RdBu 근사 색상
    function corrToColor(r) {
      const t = (r + 1) / 2; // 0~1
      let red, green, blue;
      if (t < 0.5) {
        const s = t * 2;
        red = Math.round(59 + s * (200 - 59));
        green = Math.round(76 + s * (200 - 76));
        blue = Math.round(192 + s * (220 - 192));
      } else {
        const s = (t - 0.5) * 2;
        red = Math.round(200 + s * (220 - 200));
        green = Math.round(200 - s * (200 - 60));
        blue = Math.round(220 - s * (220 - 60));
      }
      return `rgb(${red},${green},${blue})`;
    }

    // 셀
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const val = matrix[i][j];
        const x = pad.left + j * cellW;
        const y = pad.top + i * cellH;

        ctx.fillStyle = corrToColor(val);
        ctx.fillRect(x, y, cellW, cellH);
        ctx.strokeStyle = "#1a1d30";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellW, cellH);

        // 텍스트
        const fs = n > 8 ? 8 : n > 5 ? 9 : 11;
        ctx.font = `${i === j ? "bold " : ""}${fs}px JetBrains Mono`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = Math.abs(val) > 0.4 ? "#111425" : "#c0c8f0";
        ctx.fillText(val.toFixed(2), x + cellW / 2, y + cellH / 2);
      }
    }

    // 라벨
    ctx.font = `${n > 8 ? 8 : 10}px Inter`;
    ctx.fillStyle = "#8090c0";
    // 하단
    for (let j = 0; j < n; j++) {
      ctx.save();
      ctx.translate(pad.left + j * cellW + cellW / 2, h - pad.bottom + 6);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(vars[j], 0, 0);
      ctx.restore();
    }
    // 좌측
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      ctx.fillText(vars[i], pad.left - 4, pad.top + i * cellH + cellH / 2);
    }

  }, [vars, matrix, size]);

  return <canvas ref={ref} style={{ borderRadius: 10, border: "1px solid rgba(79,142,247,.12)" }} />;
}
