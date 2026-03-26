/**
 * 상관관계 분석 유틸리티
 * - 피어슨 상관계수
 * - 기초통계 (평균, 표준편차)
 * - 상관행렬 계산
 */

export function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

/** 피어슨 상관계수 */
export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  return dx2 > 0 && dy2 > 0 ? num / Math.sqrt(dx2 * dy2) : 0;
}

/** 상관관계 강도 텍스트 */
export function corrStrength(r) {
  const a = Math.abs(r);
  if (a > 0.7) return "매우 강한";
  if (a > 0.5) return "강한";
  if (a > 0.3) return "보통";
  if (a > 0.1) return "약한";
  return "거의 없는";
}

/** 상관관계 색상 */
export function corrColor(r) {
  const a = Math.abs(r);
  if (a > 0.5) return "#22c55e";
  if (a > 0.3) return "#fbbf24";
  return "#6b7280";
}

/** 상관행렬 계산. vars: string[], cases: {vals:{}, result}[] */
export function calcCorrMatrix(vars, cases) {
  const n = vars.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    const xs = cases.map((c) => c.vals[vars[i]]).filter((v) => v != null);
    for (let j = i + 1; j < n; j++) {
      const ys = cases.map((c) => c.vals[vars[j]]).filter((v) => v != null);
      // 공통 인덱스만
      const pairs = cases
        .map((c) => [c.vals[vars[i]], c.vals[vars[j]]])
        .filter(([a, b]) => a != null && b != null);
      const r = pearson(pairs.map(([a]) => a), pairs.map(([, b]) => b));
      matrix[i][j] = r;
      matrix[j][i] = r;
    }
  }
  return matrix;
}

/** 모든 변수 쌍의 상관계수 리스트, 내림차순 정렬 */
export function calcCorrPairs(vars, cases) {
  const pairs = [];
  for (let i = 0; i < vars.length; i++) {
    for (let j = i + 1; j < vars.length; j++) {
      const data = cases
        .map((c) => [c.vals[vars[i]], c.vals[vars[j]]])
        .filter(([a, b]) => a != null && b != null);
      const r = pearson(data.map(([a]) => a), data.map(([, b]) => b));
      pairs.push({ vx: vars[i], vy: vars[j], r, absR: Math.abs(r) });
    }
  }
  pairs.sort((a, b) => b.absR - a.absR);
  return pairs;
}

/** 성공확률 계산 (변수별) */
export function calcVarStats(vars, cases) {
  const stats = {};
  const sCases = cases.filter((c) => c.result === "성공");
  const fCases = cases.filter((c) => c.result === "실패");

  for (const v of vars) {
    const sVals = sCases.map((c) => c.vals[v]).filter((x) => x != null);
    const fVals = fCases.map((c) => c.vals[v]).filter((x) => x != null);
    const allVals = cases.map((c) => c.vals[v]).filter((x) => x != null);

    stats[v] = {
      sMean: mean(sVals),
      fMean: mean(fVals),
      sStd: std(sVals),
      fStd: std(fVals),
      allMean: mean(allVals),
      allStd: std(allVals),
      min: allVals.length ? Math.min(...allVals) : 0,
      max: allVals.length ? Math.max(...allVals) : 0,
      sCount: sVals.length,
      fCount: fVals.length,
    };
  }
  return stats;
}
