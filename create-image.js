const sharp = require("sharp");

/**
 * exportDebugImage(inputPath, dashes, width, height, orderedClusters)
 *
 * Tạo ảnh debug hiển thị các dash với số thứ tự theo cluster đã sắp xếp.
 *
 * @param {string} inputPath         - đường dẫn ảnh gốc
 * @param {object[]} dashes          - mảng dash feature (cần id, centroid, A, B)
 * @param {number} width
 * @param {number} height
 * @param {number[][]} orderedClusters - mảng các cluster, mỗi cluster là mảng dash.id đã sắp xếp
 *                                       Nếu không truyền, hiển thị id gốc.
 */
async function exportDebugImage(inputPath, dashes, width, height, orderedClusters) {
  // Tạo lookup: dash.id → { clusterIdx, orderInCluster }
  const dashMap = new Map();
  for (const d of dashes) dashMap.set(d.id, d);

  // Bảng màu cho các cluster khác nhau
  const clusterColors = [
    { dot: "red", label: "white", line: "rgba(255,80,80,0.5)" },
    { dot: "cyan", label: "white", line: "rgba(80,200,255,0.5)" },
    { dot: "lime", label: "white", line: "rgba(80,255,80,0.5)" },
    { dot: "magenta", label: "white", line: "rgba(255,80,255,0.5)" },
    { dot: "orange", label: "white", line: "rgba(255,180,0,0.5)" },
  ];

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

  if (orderedClusters && orderedClusters.length > 0) {
    // ── Chế độ ORDERED: hiển thị số thứ tự trong cluster + đường nối ──
    for (let ci = 0; ci < orderedClusters.length; ci++) {
      const cluster = orderedClusters[ci];
      const color = clusterColors[ci % clusterColors.length];

      // Vẽ đường nối giữa các dash liên tiếp (centroid → centroid)
      for (let i = 0; i < cluster.length - 1; i++) {
        const d1 = dashMap.get(cluster[i]);
        const d2 = dashMap.get(cluster[i + 1]);
        if (d1 && d2) {
          svg += `<line x1="${d1.centroid.x}" y1="${d1.centroid.y}" x2="${d2.centroid.x}" y2="${d2.centroid.y}" ` +
            `stroke="${color.line}" stroke-width="2" />`;
        }
      }

      // Vẽ dash: centroid + số thứ tự + endpoints
      for (let i = 0; i < cluster.length; i++) {
        const d = dashMap.get(cluster[i]);
        if (!d) continue;

        const label = `${ci + 1}.${i + 1}`;  // "Cluster.Order", ví dụ: "1.3"

        svg += `<circle cx="${d.centroid.x}" cy="${d.centroid.y}" r="4" fill="${color.dot}" />`;
        svg += `<text x="${d.centroid.x + 6}" y="${d.centroid.y - 6}" ` +
          `font-size="11" font-weight="bold" fill="${color.label}" ` +
          `stroke="black" stroke-width="0.5">${label}</text>`;
        svg += `<circle cx="${d.A.x}" cy="${d.A.y}" r="2" fill="blue" />`;
        svg += `<circle cx="${d.B.x}" cy="${d.B.y}" r="2" fill="green" />`;
      }
    }
  } else {
    // ── Chế độ RAW: hiển thị id gốc (fallback) ──
    for (const d of dashes) {
      svg += `<circle cx="${d.centroid.x}" cy="${d.centroid.y}" r="4" fill="red" />`;
      svg += `<text x="${d.centroid.x + 6}" y="${d.centroid.y - 6}" ` +
        `font-size="14" fill="yellow">${d.id}</text>`;
      svg += `<circle cx="${d.A.x}" cy="${d.A.y}" r="3" fill="blue" />`;
      svg += `<circle cx="${d.B.x}" cy="${d.B.y}" r="3" fill="green" />`;
    }
  }

  svg += `</svg>`;

  const svgBuffer = Buffer.from(svg);

  await sharp(inputPath)
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .toFile("debug_dashes_f.png");

  console.log("Exported debug_f.png");
}

module.exports = exportDebugImage;