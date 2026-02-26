function getClustersByDFS(adj) {
    const n = adj.length;
    const visited = new Uint8Array(n);
    const clusters = [];

    for (let i = 0; i < n; i++) {
        if (visited[i]) continue;

        const stack = [i];
        visited[i] = 1;
        const comp = [];

        while (stack.length) {
            const u = stack.pop();
            comp.push(u);

            for (const v of adj[u]) {
                if (!visited[v]) {
                    visited[v] = 1;
                    stack.push(v);
                }
            }
        }

        clusters.push(comp);
    }

    return clusters; // [[idx, idx, ...], ...]
}

function clustersToDashIds(clusters, dashes) {
    return clusters.map((idxs, k) => ({
        id: k + 1,
        dashIds: idxs.map(i => dashes[i].id)
    }));
}

/**
 * Lọc cluster quá nhỏ — phải gọi TRƯỚC clustersToDashIds.
 * clusters: [[idx, idx, ...], ...]  ← index array (output của getClustersByDFS)
 */
function filterSmallClusters(clusters, minSize = 2) {
    return clusters.filter(c => c.length >= minSize);
}

module.exports = { getClustersByDFS, clustersToDashIds, filterSmallClusters };