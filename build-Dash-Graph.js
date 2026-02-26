/**
 * buildDashGraph(dashes, opts)
 *
 * Xây dựng đồ thị kết nối các dash theo nguyên tắc:
 *   1. Endpoint gần nhau (trong gapThreshold)
 *   2. Hướng gần song song (trong angleDeg)
 *   3. Mỗi ENDPOINT chỉ nối với đúng 1 đối tác tốt nhất → không nối loạn ở junction
 *
 * Mỗi dash có tối đa 2 neighbor (1 qua A, 1 qua B).
 *
 * @param {Array}  dashes     - mảng dash feature từ computeDashFeature
 * @param {object} opts
 * @param {number} opts.gapMul    - hệ số nhân median len để tính khoảng cách tối đa (mặc định 2.0)
 * @param {number} opts.angleDeg  - góc lệch hướng tối đa tính bằng độ (mặc định 40)
 *
 * @returns {{ adj, gapThreshold, angleDeg, edgeInfo }}
 *   adj       - Set<number>[] — danh sách kề
 *   edgeInfo  - Map: "i-j" → { dist, angleDeg } — thông tin cạnh để debug
 */
function buildDashGraphKNN(dashes, {
    gapMul = 2.0,
    angleDeg = 40,
    k = 3
} = {}) {
    const n = dashes.length;
    const adj = Array.from({ length: n }, () => new Set());
    const edgeInfo = new Map(); // Optional debug edgeInfo

    const medianLen = median(dashes.map(d => d.len).filter(x => x > 0));
    const gapThreshold = Math.max(5, gapMul * (medianLen || 10));
    const angleRad = angleDeg * Math.PI / 180;

    // 1) precompute candidate list by endpoint distance
    for (let i = 0; i < n; i++) {
        const cand = [];
        for (let j = 0; j < n; j++) {
            if (i === j) continue;

            const dMin = minEndpointDistance(dashes[i], dashes[j]);
            if (dMin > gapThreshold) continue;

            const ang = angleBetween(dashes[i].dir, dashes[j].dir);
            if (ang > angleRad) continue;

            if (!isDirectionallyCompatible(dashes[i], dashes[j])) continue;

            cand.push({ j, dMin });
        }

        // 2) keep only K nearest and filter by distance ratio
        cand.sort((a, b) => a.dMin - b.dMin);
        const d1 = cand[0]?.dMin ?? Infinity;
        const top = cand.filter(x => x.dMin <= d1 * 2.0).slice(0, k);

        for (const { j, dMin } of top) {
            adj[i].add(j);
        }
    }

    // 3) make it undirected + mutual (chỉ giữ cạnh nếu i chọn j và j cũng chọn i)
    for (let i = 0; i < n; i++) {
        for (const j of Array.from(adj[i])) {
            if (!adj[j].has(i)) adj[i].delete(j);
        }
    }
    // build symmetric sets
    const und = Array.from({ length: n }, () => new Set());
    for (let i = 0; i < n; i++) {
        for (const j of adj[i]) { und[i].add(j); und[j].add(i); }
    }

    return { adj: und, gapThreshold, angleDeg, edgeInfo };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function minEndpointDistance(da, db) {
    const pA1 = da.A, pA2 = da.B;
    const pB1 = db.A, pB2 = db.B;
    return Math.min(
        Math.hypot(pA1.x - pB1.x, pA1.y - pB1.y),
        Math.hypot(pA1.x - pB2.x, pA1.y - pB2.y),
        Math.hypot(pA2.x - pB1.x, pA2.y - pB1.y),
        Math.hypot(pA2.x - pB2.x, pA2.y - pB2.y)
    );
}

function isDirectionallyCompatible(di, dj, maxTurnDeg = 60) {
    const v = normalize({
        x: dj.centroid.x - di.centroid.x,
        y: dj.centroid.y - di.centroid.y,
    });

    const dot = di.dir.x * v.x + di.dir.y * v.y;
    const cosMin = Math.cos(maxTurnDeg * Math.PI / 180);

    // cho phép cả xuôi và ngược vì dir không định hướng, nên dùng abs
    if (Math.abs(dot) < cosMin) return false;

    return true;
}

function normalize(v) {
    const l = Math.hypot(v.x, v.y);
    return l > 1e-9 ? { x: v.x / l, y: v.y / l } : { x: 1, y: 0 };
}

/** Góc nhọn (0..π/2) giữa 2 vector đơn vị — không phân biệt chiều */
function angleBetween(u, v) {
    const dot = Math.abs(u.x * v.x + u.y * v.y);
    const clamped = Math.min(1, dot);
    return Math.acos(clamped);
}

function median(arr) {
    const a = arr.slice().sort((x, y) => x - y);
    if (!a.length) return 0;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

module.exports = buildDashGraphKNN;