/**
 * pruneJunctions(adj, dashes)
 *
 * Cắt bớt các cạnh "nhánh sai" để ép graph thành cấu trúc path-like (chain).
 * Sau khi prune: mỗi dash có tối đa 2 neighbor.
 *
 * Thuật toán:
 *   1. Với mỗi dash i có degree > 2, tính score cho từng neighbor:
 *      score = |dir_i · v_ij| (v_ij = vector từ endpoint gần nhất của i tới j)
 *      → score cao = neighbor nằm dọc theo trục dash = đúng hướng
 *   2. Đánh dấu cạnh muốn GIỮ và muốn XÓA từ cả 2 phía
 *   3. Chỉ xóa cạnh nếu ÍT NHẤT 1 phía không muốn giữ (asymmetric prune)
 *      → an toàn hơn: tránh trường hợp 2 dash hợp lệ xóa nhau
 */
function pruneJunctions(adj, dashes) {
    const n = adj.length;

    // ── Bước 1: Mỗi dash chọn tối đa 2 neighbor tốt nhất ─────────────────────
    // wantKeep[i] = Set of j mà dash i muốn giữ
    const wantKeep = Array.from({ length: n }, () => new Set());

    for (let i = 0; i < n; i++) {
        const neighbors = Array.from(adj[i]);

        if (neighbors.length <= 2) {
            // Degree ổn, giữ tất cả
            for (const j of neighbors) wantKeep[i].add(j);
            continue;
        }

        const di = dashes[i];

        // Score từng neighbor: đo mức "thẳng hàng" với trục di.dir
        const scored = neighbors.map(j => {
            const v = normalize(vectorBetweenClosestEndpoints(di, dashes[j]));
            const score = Math.abs(di.dir.x * v.x + di.dir.y * v.y);
            return { j, score };
        });

        // Giữ 2 neighbor thẳng nhất
        scored.sort((a, b) => b.score - a.score);
        for (const { j } of scored.slice(0, 2)) {
            wantKeep[i].add(j);
        }
    }

    // ── Bước 2: Thu thập cạnh cần xóa ────────────────────────────────────────
    // Xóa cạnh (i, j) nếu ÍT NHẤT 1 trong 2 phía không muốn giữ
    // (dùng Set để tránh xóa trùng)
    const toDelete = new Set();

    for (let i = 0; i < n; i++) {
        for (const j of adj[i]) {
            if (!wantKeep[i].has(j) || !wantKeep[j].has(i)) {
                const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
                toDelete.add(key);
            }
        }
    }

    // ── Bước 3: Xóa một lần duy nhất (không mutation inside loop) ────────────
    for (const key of toDelete) {
        const [i, j] = key.split('-').map(Number);
        adj[i].delete(j);
        adj[j].delete(i);
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Tìm vector từ endpoint gần nhất của a đến endpoint gần nhất của b.
 * Trả về vector chỉ hướng từ a tới b.
 */
function vectorBetweenClosestEndpoints(a, b) {
    const pairs = [
        { p: a.A, q: b.A },
        { p: a.A, q: b.B },
        { p: a.B, q: b.A },
        { p: a.B, q: b.B },
    ];

    let best = pairs[0];
    let bestDist = dist(best.p, best.q);

    for (let k = 1; k < pairs.length; k++) {   // bắt đầu từ 1, tránh so sánh dư thừa
        const d = dist(pairs[k].p, pairs[k].q);
        if (d < bestDist) { bestDist = d; best = pairs[k]; }
    }

    return { x: best.q.x - best.p.x, y: best.q.y - best.p.y };
}

function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(v) {
    const len = Math.hypot(v.x, v.y);
    return len > 1e-9 ? { x: v.x / len, y: v.y / len } : { x: 1, y: 0 };
}

module.exports = pruneJunctions;