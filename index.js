const loadBinaryImage = require("./image-reader");
const connectedComponents = require("./component-connect");
const computeDashFeature = require("./compute-Dash-Feature");
const buildDashGraph = require("./build-Dash-Graph");
const pruneJunctions = require("./prune-Junctions");
const mergeClusters = require('./merge-Clusters');
const { getClustersByDFS, filterSmallClusters } = require("./get-Clusters-By-DFS");
const orderCluster = require("./order-Cluster");
const buildCenterlineForStroke = require("./build-Centerline-ForStroke");
const exportDebugImage = require("./create-image");
async function run(path) {
  // 1–3. Load → Components → Features
  const { bin, width, height } = await loadBinaryImage(path);
  const comps = connectedComponents(bin, width, height, 10);
  console.log("comps", comps.length);
  const dashes = comps.map((pixels, idx) => ({
    id: idx + 1,
    ...computeDashFeature(pixels),
  }));

  // 4–5. Graph + Prune
  const { adj } = buildDashGraph(dashes);
  console.log("adj", adj.length);

  pruneJunctions(adj, dashes);

  let maxDegree = 0;
  for (let i = 0; i < adj.length; i++) {
    maxDegree = Math.max(maxDegree, adj[i].size);
  }
  console.log("Max degree after prune:", maxDegree);

  // 6. DFS Clustering
  let clusters = getClustersByDFS(adj);

  // 6.5 POST-MERGE CLUSTERS (Gộp nhánh đứt)
  // Thực hiện gộp trước khi lọc để không làm mất các dash đơn lẻ (size=1) nhưng thuộc về nét vẽ
  clusters = mergeClusters(clusters, adj, dashes, 3.0);

  // 6.7 Lọc các cluster thực sự là nhiễu (vẫn chỉ có 1 dash sau khi merge)
  clusters = filterSmallClusters(clusters, 2);

  // Sắp xếp các cluster theo thứ tự đọc: Trái qua phải, Trên xuống dưới
  clusters.sort((a, b) => {
    // Tìm dash trái nhất trong mỗi cluster làm đại diện
    const getLeftmost = (cluster) => cluster.reduce((best, idx) => {
      const cb = dashes[best].centroid;
      const ci = dashes[idx].centroid;
      if (ci.x < cb.x - 2) return idx;
      if (ci.x > cb.x + 2) return best;
      return ci.y < cb.y ? idx : best;
    }, cluster[0]);

    const dashA = dashes[getLeftmost(a)].centroid;
    const dashB = dashes[getLeftmost(b)].centroid;

    // Ưu tiên x nhỏ hơn (trái hơn)
    if (dashA.x < dashB.x - 10) return -1;
    if (dashA.x > dashB.x + 10) return 1;
    // Nếu x gần bằng nhau, ưu tiên y nhỏ hơn (cao hơn)
    return dashA.y - dashB.y;
  });

  console.log(`Clusters: ${clusters.length}  sizes: [${clusters.map(c => c.length).join(", ")}]\n`);

  // 7–8. Order + Build centerline
  const allOrderedIds = [];

  for (let k = 0; k < clusters.length; k++) {
    const orderedIds = orderCluster(clusters[k], adj, dashes);
    allOrderedIds.push(orderedIds);
    const polyline = buildCenterlineForStroke(orderedIds, dashes);

    // Verify: mỗi dash đóng góp đúng 2 điểm
    const expectedPts = orderedIds.length * 2;
    const ok = polyline.length === expectedPts;

    const xs = polyline.map(p => p[0]), ys = polyline.map(p => p[1]);
    console.log(`Cluster ${k + 1}:`);
    console.log(`  dashes: ${orderedIds.length}  pts: ${polyline.length}  expected: ${expectedPts}  ${ok ? "✅" : "❌"}`);
    console.log(`  bbox x: [${Math.round(Math.min(...xs))}, ${Math.round(Math.max(...xs))}]`);
    console.log(`  bbox y: [${Math.round(Math.min(...ys))}, ${Math.round(Math.max(...ys))}]`);
    console.log(`  first 3 pts:`, polyline.slice(0, 3), "\n");
  }

  // 9. Export debug image VỚI thứ tự đã sắp xếp
  await exportDebugImage(path, dashes, width, height, allOrderedIds);
}

run("letter_f_dashed.png");