// Thin-Plate-Spline: glatte Abbildung, die die Punkte quelle[i] auf ziel[i] legt (lambda > 0 glättet).
// Gebraucht für den Hintergrund und die Ausgangslage der Bushaltestellen im Plan.

export function tps(quelle, ziel, lambda) {
  const n = quelle.length;
  const U = (r2) => (r2 > 0 ? r2 * Math.log(r2) * 0.5 : 0); // r² log r
  const N = n + 3;
  const A = Array.from({ length: N }, () => new Float64Array(N));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dx = quelle[i][0] - quelle[j][0], dy = quelle[i][1] - quelle[j][1];
      A[i][j] = U(dx * dx + dy * dy) + (i === j ? lambda : 0);
    }
    A[i][n] = A[n][i] = 1;
    A[i][n + 1] = A[n + 1][i] = quelle[i][0];
    A[i][n + 2] = A[n + 2][i] = quelle[i][1];
  }
  const loesen = (b) => {
    const M = A.map((r) => Float64Array.from(r));
    const x = Float64Array.from(b);
    for (let k = 0; k < N; k++) {
      let p = k;
      for (let i = k + 1; i < N; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      [M[k], M[p]] = [M[p], M[k]];
      [x[k], x[p]] = [x[p], x[k]];
      for (let i = k + 1; i < N; i++) {
        const f = M[i][k] / M[k][k];
        if (!f) continue;
        for (let j = k; j < N; j++) M[i][j] -= f * M[k][j];
        x[i] -= f * x[k];
      }
    }
    for (let k = N - 1; k >= 0; k--) {
      let s = x[k];
      for (let j = k + 1; j < N; j++) s -= M[k][j] * x[j];
      x[k] = s / M[k][k];
    }
    return x;
  };
  const wx = loesen([...ziel.map((p) => p[0]), 0, 0, 0]);
  const wy = loesen([...ziel.map((p) => p[1]), 0, 0, 0]);
  return ([x, y]) => {
    let fx = wx[n] + wx[n + 1] * x + wx[n + 2] * y;
    let fy = wy[n] + wy[n + 1] * x + wy[n + 2] * y;
    for (let i = 0; i < n; i++) {
      const dx = x - quelle[i][0], dy = y - quelle[i][1];
      const u = U(dx * dx + dy * dy);
      fx += wx[i] * u;
      fy += wy[i] * u;
    }
    return [fx, fy];
  };
}
