/**
 * Gộp các cluster (nét) bị đứt rời do quá trình prune hoặc KNN filter chặn lại.
 * 
 * Ý tưởng:
 * - Sau khi có các cluster (mảng các index dash), mỗi cluster sẽ tạo thành 1 hoặc nhiều "đầu mút" (endpoints).
 * - "Đầu mút" của một cluster là các dash có bậc (degree) = 1 khi chỉ xét các dash TONG cluster.
 * - Tính khoảng cách giữa các đầu mút của các cặp cluster khác nhau.
 * - Nếu khoảng cách < mergeThreshold và chiều hướng không bị ngược nhau, tiến hành gộp 2 cluster làm 1.
 */

function mergeClusters(clusters, adj, dashes, gapMul = 3.0) {
    const medianLen = median(dashes.map(d => d.len).filter(x => x > 0));
    const mergeThreshold = gapMul * (medianLen || 10);

    let merged = true;
    let currentClusters = [...clusters]; // Copy từ ban đầu

    while (merged) {
        merged = false;
        let bestPair = null;
        let bestDist = Infinity;

        // Tìm 2 cluster có endpoint gần nhất
        for (let i = 0; i < currentClusters.length; i++) {
            for (let j = i + 1; j < currentClusters.length; j++) {
                const endsI = getClusterEndpoints(currentClusters[i], adj);
                const endsJ = getClusterEndpoints(currentClusters[j], adj);

                for (const ei of endsI) {
                    for (const ej of endsJ) {
                        const dist = minEndpointDistance(dashes[ei], dashes[ej]);

                        if (dist < mergeThreshold && dist < bestDist) {
                            // Kiểm tra hướng (không gộp ngược chiều 180 độ)
                            if (isDirectionallyCompatible(dashes[ei], dashes[ej])) {
                                bestDist = dist;
                                bestPair = { i, j, ei, ej };
                            }
                        }
                    }
                }
            }
        }

        if (bestPair) {
            // Thực hiện gộp
            const { i, j, ei, ej } = bestPair;

            // 1. Thêm cạnh nối vào đồ thị gốc để DFS/Order nhận ra nhau
            adj[ei].add(ej);
            adj[ej].add(ei);

            // 2. Gộp mảng cluster
            const newCluster = [...currentClusters[i], ...currentClusters[j]];

            // Phải xóa phần tử lớn hơn trước để tránh sai lệch index!
            // Xoá 2 cluster cũ, thêm cluster mới
            currentClusters.splice(Math.max(i, j), 1);
            currentClusters.splice(Math.min(i, j), 1);
            currentClusters.push(newCluster);

            merged = true;
        }
    }

    return currentClusters;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getClusterEndpoints(clusterIdxs, adj) {
    const clusterSet = new Set(clusterIdxs);
    const ends = clusterIdxs.filter(i => {
        const degreeInCluster = Array.from(adj[i]).filter(neigh => clusterSet.has(neigh)).length;
        return degreeInCluster <= 1; // Đầu mút là dash có 0 hoặc 1 kết nối tới ae trong cluster
    });
    // Fallback: nếu cluster là vòng (degree = 2 hết), lấy đại 2 dash xa nhất (hoặc tất cả)
    if (ends.length === 0) return clusterIdxs;
    return ends;
}

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

function isDirectionallyCompatible(di, dj, maxTurnDeg = 80) {
    // Góc bẻ tối đa khi nối 2 cluster đứt (80 độ để nối được góc vuông/cua gắt)
    const v = normalize({
        x: dj.centroid.x - di.centroid.x,
        y: dj.centroid.y - di.centroid.y,
    });

    const dot = di.dir.x * v.x + di.dir.y * v.y;
    const cosMin = Math.cos(maxTurnDeg * Math.PI / 180);

    return Math.abs(dot) >= cosMin;
}

function normalize(v) {
    const l = Math.hypot(v.x, v.y);
    return l > 1e-9 ? { x: v.x / l, y: v.y / l } : { x: 1, y: 0 };
}

function median(arr) {
    const a = arr.slice().sort((x, y) => x - y);
    if (!a.length) return 0;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

module.exports = mergeClusters;
