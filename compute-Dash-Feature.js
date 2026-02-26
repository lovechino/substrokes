/**
 * computeDashFeature(pixels)
 *
 * Tính các đặc trưng hình học của một dash (nét đứt) từ danh sách pixel.
 *
 * Đầu vào:  pixels = [{x, y}, ...]
 * Đầu ra:
 *   centroid  – trọng tâm thống kê
 *   dir       – vector hướng chính (PCA), độ dài = 1
 *   A, B      – hai ENDPOINT được chiếu lên trục dir (điểm đầu/cuối "sạch")
 *   M         – midpoint của A và B (= tâm thực của đoạn thẳng)
 *   Ap        – điểm đối xứng của A qua M (= A' dùng cho DashTraceManager)
 *   len       – chiều dài ước tính của dash (tMax - tMin)
 *   area      – số pixel
 */
function computeDashFeature(pixels) {
    if (!pixels || pixels.length < 2) {
        return {
            centroid: { x: 0, y: 0 },
            dir: { x: 1, y: 0 },
            A: { x: 0, y: 0 },
            B: { x: 0, y: 0 },
            M: { x: 0, y: 0 },
            Ap: { x: 0, y: 0 },
            len: 0,
            area: pixels?.length ?? 0,
        };
    }

    // ── 1. Centroid ──────────────────────────────────────────────────────────
    let sx = 0, sy = 0;
    for (const p of pixels) { sx += p.x; sy += p.y; }
    const cx = sx / pixels.length;
    const cy = sy / pixels.length;

    // ── 2. Covariance matrix ─────────────────────────────────────────────────
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of pixels) {
        const X = p.x - cx;
        const Y = p.y - cy;
        sxx += X * X;
        syy += Y * Y;
        sxy += X * Y;
    }
    sxx /= pixels.length;
    syy /= pixels.length;
    sxy /= pixels.length;

    // ── 3. Principal direction (PCA) ─────────────────────────────────────────
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const dir = normalize({ x: Math.cos(theta), y: Math.sin(theta) });

    // ── 4. Project all pixels onto dir, find tMin / tMax ────────────────────
    //   t = scalar projection: t = p · dir
    //   Projected point: P_proj = origin + t * dir
    //   Ta dùng centroid làm gốc để projection ổn định hơn
    let tMin = Infinity, tMax = -Infinity;

    for (const p of pixels) {
        const t = (p.x - cx) * dir.x + (p.y - cy) * dir.y;
        if (t < tMin) tMin = t;
        if (t > tMax) tMax = t;
    }

    // ── 5. Endpoints A, B là điểm CHIẾU trên trục dir ───────────────────────
    //   Đây là "projected endpoints" — sạch hơn so với dùng pixel thô
    const A = { x: cx + tMin * dir.x, y: cy + tMin * dir.y };
    const B = { x: cx + tMax * dir.x, y: cy + tMax * dir.y };

    // ── 6. Midpoint M và điểm đối xứng A' ───────────────────────────────────
    //   M  = trung điểm AB (tâm thực của dash)
    //   A' = đối xứng A qua M = 2M - A  (= B, nhưng giữ riêng cho rõ ý đồ)
    const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    const Ap = { x: 2 * M.x - A.x, y: 2 * M.y - A.y }; // ≡ B

    return {
        centroid: { x: cx, y: cy },
        dir,
        A,
        B,
        M,
        Ap,
        len: Math.max(0, tMax - tMin),
        area: pixels.length,
    };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalize(v) {
    const l = Math.hypot(v.x, v.y);
    if (l < 1e-9) return { x: 1, y: 0 };
    return { x: v.x / l, y: v.y / l };
}

module.exports = computeDashFeature;
