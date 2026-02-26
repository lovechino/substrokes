/**
 * buildCenterlineForStroke(dashIds, dashes)
 *
 * Nối các dash theo thứ tự dashIds → tạo polyline centerline.
 *
 * Format output: [[x, y], [x, y], ...]
 * Mỗi dash đóng góp 2 điểm (start + end), tạo ra đoạn thẳng nhỏ.
 * Khoảng trống giữa 2 dash được thể hiện tự nhiên qua jump điểm liên tiếp.
 *
 * @param {number[]} dashIds - mảng dash.id đã được sắp xếp (output của orderCluster)
 * @param {object[]} dashes  - mảng dash feature (cần id, A, B, dir)
 * @returns {[number, number][]} polyline
 */
function buildCenterlineForStroke(dashIds, dashes) {
    if (dashIds.length === 0) return [];

    // Build id → dash lookup
    const dashMap = new Map();
    for (const d of dashes) dashMap.set(d.id, d);

    const polyline = [];
    let prevPoint = null;

    for (let k = 0; k < dashIds.length; k++) {
        const dash = dashMap.get(dashIds[k]);
        if (!dash) continue;

        let start, end;

        if (k === 0) {
            // ── Dash đầu tiên: dùng khoảng cách tới dash thứ 2 để xác định chiều ──
            if (dashIds.length > 1) {
                const nextDash = dashMap.get(dashIds[1]);
                if (nextDash) {
                    const distAToNext = Math.min(dist(dash.A, nextDash.A), dist(dash.A, nextDash.B));
                    const distBToNext = Math.min(dist(dash.B, nextDash.A), dist(dash.B, nextDash.B));
                    // Điểm nào gần nextDash hơn thì nó phải là END của dash đầu tiên
                    if (distBToNext < distAToNext) {
                        start = dash.A; end = dash.B;
                    } else {
                        start = dash.B; end = dash.A;
                    }
                } else {
                    start = dash.A; end = dash.B; // Fallback
                }
            } else {
                // Stroke chỉ có 1 dash: ưu tiên lấy điểm cao hơn (y nhỏ hơn) làm start
                if (dash.A.y <= dash.B.y) {
                    start = dash.A; end = dash.B;
                } else {
                    start = dash.B; end = dash.A;
                }
            }
        } else {
            // ── Dash tiếp theo: endpoint nào gần prevPoint hơn → là start ────────
            const distA = dist(prevPoint, dash.A);
            const distB = dist(prevPoint, dash.B);
            if (distA <= distB) {
                start = dash.A; end = dash.B;
            } else {
                start = dash.B; end = dash.A;
            }
        }

        // FIX: push CẢ start VÀ end
        // - Dash đầu: push start + end (2 điểm)
        // - Dash sau: push start + end (2 điểm)
        //   start ≠ prevPoint vì có gap giữa 2 dash → thể hiện đúng khoảng trống
        polyline.push([start.x, start.y]);
        polyline.push([end.x, end.y]);

        prevPoint = end;
    }

    return polyline;
}

function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

module.exports = buildCenterlineForStroke;