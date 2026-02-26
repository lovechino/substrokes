/**
 * orderCluster(cluster, adj, dashes)
 *
 * Sắp xếp các dash trong 1 cluster thành chuỗi có thứ tự liên tục về mặt không gian.
 *
 * Thuật toán:
 *   1. Tìm tất cả endpoints (degree=1) trong sub-graph cluster.
 *   2. Chọn start = endpoint có vị trí top-left nhất (ưu tiên y nhỏ, rồi x nhỏ).
 *   3. Walk graph: tại mỗi bước, nếu có nhiều neighbor chưa thăm,
 *      chọn neighbor có endpoint gần "exit point" nhất (spatial greedy).
 *   4. Sweep: nếu còn dash chưa thăm (do gap trong graph), nối bằng nearest-neighbor.
 *
 * @param {number[]} cluster       - chỉ số dashes thuộc cluster
 * @param {Set<number>[]} adj      - adjacency list (sau prune + merge)
 * @param {object[]} dashes        - mảng dash feature
 * @returns {number[]}             - mảng dash.id theo thứ tự
 */
function orderCluster(cluster, adj, dashes) {
    if (cluster.length === 0) return [];
    if (cluster.length === 1) return [dashes[cluster[0]].id];

    const clusterSet = new Set(cluster);

    // ── Bước 1: Tìm endpoints (degree=1 trong sub-graph) ──────────────────
    const endpoints = cluster.filter(i => {
        const degInCluster = [...adj[i]].filter(n => clusterSet.has(n)).length;
        return degInCluster === 1;
    });

    // ── Bước 2: Chọn start = endpoint leftmost, sau đó topmost ────────────────
    let start;
    if (endpoints.length > 0) {
        // Ưu tiên x nhỏ nhất (trái nhất), sau đó y nhỏ nhất (trên nhất)
        start = endpoints.reduce((best, idx) => {
            const cb = dashes[best].centroid;
            const ci = dashes[idx].centroid;
            // Cho phép sai số nhỏ (1px) để tránh jump do rung lắc tọa độ
            if (ci.x < cb.x - 1) return idx;
            if (ci.x > cb.x + 1) return best;
            return ci.y < cb.y ? idx : best;
        });
    } else {
        // Stroke vòng (circle): lấy dash trái nhất
        start = cluster.reduce((best, idx) => {
            const cb = dashes[best].centroid;
            const ci = dashes[idx].centroid;
            if (ci.x < cb.x - 1) return idx;
            if (ci.x > cb.x + 1) return best;
            return ci.y < cb.y ? idx : best;
        });
    }

    // ── Bước 3: Greedy spatial walk ───────────────────────────────────────
    const ordered = [];
    const visited = new Set();
    let curr = start;
    let exitPoint = null; // điểm "ra" của dash vừa đi qua

    while (curr != null) {
        ordered.push(dashes[curr].id);
        visited.add(curr);

        // Xác định exit point: endpoint nào của curr xa entry point hơn → đó là exit
        const dashCurr = dashes[curr];
        if (exitPoint == null) {
            // Dash đầu tiên: exit = endpoint xa start hơn về hướng stroke
            // Nếu có dash kế, exit = endpoint gần dash kế nhất (sẽ là end)
            // Nếu không, dùng B mặc định
            exitPoint = dashCurr.B;
        } else {
            // Entry = endpoint gần exitPoint trước đó
            const distA = dist(exitPoint, dashCurr.A);
            const distB = dist(exitPoint, dashCurr.B);
            // exit = endpoint CÒN LẠI (đầu kia)
            exitPoint = distA <= distB ? dashCurr.B : dashCurr.A;
        }

        // Tìm neighbor chưa thăm trong cluster
        const neighbors = [...adj[curr]]
            .filter(n => clusterSet.has(n) && !visited.has(n));

        if (neighbors.length === 0) {
            curr = null;
        } else if (neighbors.length === 1) {
            curr = neighbors[0];
        } else {
            // Nhiều neighbor: chọn cái có endpoint gần exitPoint nhất
            let bestNeigh = neighbors[0];
            let bestDist = minEndpointDist(exitPoint, dashes[neighbors[0]]);

            for (let k = 1; k < neighbors.length; k++) {
                const d = minEndpointDist(exitPoint, dashes[neighbors[k]]);
                if (d < bestDist) {
                    bestDist = d;
                    bestNeigh = neighbors[k];
                }
            }
            curr = bestNeigh;
        }
    }

    // ── Bước 4: Sweep unvisited (do gap trong graph) ──────────────────────
    const unvisited = cluster.filter(i => !visited.has(i));

    if (unvisited.length > 0) {
        // Sắp xếp unvisited theo nearest-neighbor từ exit point cuối cùng
        const remaining = new Set(unvisited);

        while (remaining.size > 0) {
            let bestIdx = null;
            let bestD = Infinity;

            for (const idx of remaining) {
                const d = minEndpointDist(exitPoint, dashes[idx]);
                if (d < bestD) {
                    bestD = d;
                    bestIdx = idx;
                }
            }

            ordered.push(dashes[bestIdx].id);
            remaining.delete(bestIdx);

            // Cập nhật exit point
            const dashNext = dashes[bestIdx];
            const distA = dist(exitPoint, dashNext.A);
            const distB = dist(exitPoint, dashNext.B);
            exitPoint = distA <= distB ? dashNext.B : dashNext.A;
        }
    }

    return ordered;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Khoảng cách giữa 1 điểm p và endpoint gần nhất của dash d */
function minEndpointDist(p, dash) {
    return Math.min(
        dist(p, dash.A),
        dist(p, dash.B)
    );
}

function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

module.exports = orderCluster;
