# Substrokes — Thuật toán & Cấu trúc dữ liệu

## Tổng quan Pipeline

Hệ thống xử lý ảnh PNG chữ viết tay dạng nét đứt (dashed), tách các nét nhỏ (dash), phân cụm rồi sắp xếp thành **polyline centerline** — phục vụ game tô chữ trẻ em.

```
PNG → Binary → Components → Features → Graph → Prune → Clusters → Order → Centerline
 1       2          3           4         5        6        7         8          9
```

---

## Cấu trúc dữ liệu chính

### `Uint8Array` — Ảnh nhị phân
```js
// bin[y * width + x] = 1 (nét) hoặc 0 (nền)
const bin = new Uint8Array(width * height);
```
**Tại sao dùng `Uint8Array` thay vì `Array`?**  
Tiết kiệm bộ nhớ 4–8×, truy cập theo tọa độ O(1), thân thiện với cache CPU. Ảnh PNG kích thước 1000×1000 chỉ cần 1 MB thay vì 8 MB.

---

### `Set<number>[]` — Adjacency List (Danh sách kề)
```js
const adj = Array.from({ length: n }, () => new Set());
// adj[i] = Set chứa chỉ số các dash láng giềng của dash i
```
**Tại sao dùng `Set` thay vì `Array`?**  
Thêm/xóa/kiểm tra tồn tại O(1). Quan trọng ở bước Prune khi cần xóa cạnh nhanh mà không duyệt lại.

---

### `Dash Feature Object` — Đặc trưng hình học
```js
{
  id:       number,       // ID duy nhất (1-indexed)
  centroid: { x, y },    // trọng tâm thống kê
  dir:      { x, y },    // vector hướng chính (unit vector, từ PCA)
  A:        { x, y },    // endpoint đầu (projected lên trục dir)
  B:        { x, y },    // endpoint cuối (projected lên trục dir)
  M:        { x, y },    // midpoint = (A + B) / 2
  Ap:       { x, y },    // A' = đối xứng A qua M (dùng cho DashTraceManager)
  len:      number,      // chiều dài ước tính (tMax − tMin)
  area:     number,      // số pixel
}
```

---

### `Map<id, dash>` — Lookup bảng
```js
const dashMap = new Map();
for (const d of dashes) dashMap.set(d.id, d);
```
**Tác dụng:** Tra cứu dash theo `id` trong O(1) tại bước dựng centerline, thay vì phải duyệt mảng O(n) mỗi lần.

---

## Thuật toán từng bước

---

### Bước 1 — `image-reader.js`: Grayscale Thresholding

**Thuật toán:** Weighted grayscale + alpha threshold  
**Độ phức tạp:** O(W × H)

```
gray = 0.299·R + 0.587·G + 0.114·B   ← trọng số theo cảm nhận mắt người
alpha < 10  → bin = 0 (nền trong suốt)
gray < 128  → bin = 1 (nét tối)
gray >= 128 → bin = 0 (nền sáng)
```

**Tác dụng:**  
Chuyển ảnh màu RGBA nhiều chiều thành mảng nhị phân 1-bit đơn giản.  
- Dùng weighted average (không phải average đơn giản) vì mắt người nhạy cảm hơn với kênh G (xanh lá) → phân biệt nét/nền chính xác hơn.
- Lọc alpha trước → ảnh PNG có nền trong suốt không bị nhầm thành nét.

---

### Bước 2 — `component-connect.js`: Flood Fill DFS 8 hướng

**Thuật toán:** Iterative DFS với explicit stack (không đệ quy)  
**Độ phức tạp:** O(W × H)

```
8 hướng lân cận:
  ↖ ↑ ↗
  ← · →
  ↙ ↓ ↘
```

```js
const stack = [[x, y]];
while (stack.length) {
  const [cx, cy] = stack.pop();   // LIFO → DFS
  pixels.push({ x: cx, y: cy });
  for (const [dx, dy] of dirs) {
    if (bin[ni] === 1 && !visited[ni]) stack.push([nx, ny]);
  }
}
```

**Tác dụng:**  
Tìm tất cả các **blob pixel liên thông** trên ảnh nhị phân — mỗi blob tương ứng đúng 1 nét đứt (dash) rời rạc.

- **Tại sao 8 hướng thay vì 4 hướng?** Vì nét nghiêng 45° vẫn phải được coi là liên thông. Với 4 hướng, nét góc 45° bị tách thành nhiều dash nhỏ → kết quả sai.
- **Tại sao dùng stack thay vì đệ quy?** Ảnh lớn (1000×1000) có thể có component 1 triệu pixel → đệ quy bị tràn call stack. Stack tường minh an toàn với mọi kích thước.
- **Lọc `minArea = 10`:** Loại bỏ nhiễu pixel đơn lẻ không phải nét thực.

---

### Bước 3 — `compute-Dash-Feature.js`: PCA 2D

**Thuật toán:** Principal Component Analysis đơn giản hóa cho 2D  
**Độ phức tạp:** O(N pixels) per component

| Bước | Công thức | Ý nghĩa |
|------|-----------|---------|
| 1. Centroid | `cx = Σx/n, cy = Σy/n` | Trọng tâm thống kê của cụm pixel |
| 2. Covariance | `sxx = Σ(x−cx)²/n` ... | Ma trận hiệp phương sai 2×2 |
| 3. Principal direction | `θ = 0.5 × atan2(2·sxy, sxx−syy)` | Eigenvector ứng với eigenvalue lớn nhất |
| 4. Projection | `t = (p − centroid) · dir` | Chiếu mỗi pixel lên trục chính |
| 5. Endpoints A, B | `centroid + tMin·dir`, `centroid + tMax·dir` | 2 đầu mút "sạch" trên trục chính |
| 6. M, A' | `M = (A+B)/2`, `A' = 2M − A` | Midpoint và điểm đối xứng |

```
Pixel thô:  ● ● ● ●  ●  ● ●   (không đều, có offset)
Sau PCA:    A ────── M ────── B   (đều, trên trục dir)
```

**Tác dụng:**  
- Tìm **hướng thực** của nét bằng cách tối đa hóa phương sai — chính xác hơn nhiều so với dùng bounding box với nét nghiêng.  
- Tạo ra các endpoint A, B "sạch" (smooth, không bị ảnh hưởng bởi pixel nhiễu đơn lẻ).  
- `dir` và `A, B` là nền tảng cho mọi bước tiếp theo: xây graph, prune, order, centerline.

---

### Bước 4 — `build-Dash-Graph.js`: KNN + Mutual Edge Filter

**Thuật toán:** K-Nearest Neighbor Greedy Matching với 3 điều kiện lọc  
**Độ phức tạp:** O(n²)

**3 điều kiện để nối dash i với j:**

```
1. minEndpointDistance(i, j) < gapThreshold
   gapThreshold = gapMul × median(len)   ← adaptive, không hardcode

2. angleBetween(dir_i, dir_j) < 40°
   dùng |dot product| → 0..90° (không phân biệt chiều dir)

3. isDirectionallyCompatible(i, j)
   vector centroid_i → centroid_j phải gần song song với dir_i
```

**Mutual edge filter — chỉ giữ cạnh 2 chiều:**
```js
// i chọn j nhưng j không chọn i → xóa cạnh
if (!adj[j].has(i)) adj[i].delete(j);
```

**Tác dụng:**  
Xây dựng đồ thị biểu diễn mối quan hệ "nét nào nối tiếp nét nào".

- **Endpoint distance** thay vì centroid distance: 2 dash dài, nằm thẳng hàng, centroid cách xa nhau nhưng endpoint lại rất gần → vẫn nối đúng.
- **Adaptive threshold** (nhân với median_len): tự động thích nghi với từng font chữ lớn/nhỏ.
- **Mutual filter**: loại bỏ liên kết sai 1 chiều — nếu dash A muốn nối B nhưng B thực ra gần C hơn, cạnh A-B bị xóa.

---

### Bước 5 — `prune-Junctions.js`: Score-based Asymmetric Pruning

**Thuật toán:** Greedy score ranking + asymmetric delete  
**Độ phức tạp:** O(n × max_degree)

**Vấn đề:** Tại ngã ba (junction), 1 dash có thể có degree > 2 → không thể tạo thành chuỗi đơn.

**Giải pháp:**
```
1. Với mỗi dash i có degree > 2:
   score(j) = |dir_i · v_ij|    ← v_ij = vector từ endpoint gần nhất i đến j
   score = 1: j nằm thẳng hàng với trục dash (✅ đúng hướng)
   score = 0: j nằm vuông góc  (❌ nhánh sai)

2. Giữ lại 2 neighbor có score cao nhất → wantKeep[i]

3. Xóa cạnh (i, j) nếu ÍT NHẤT 1 phía không muốn giữ:
   if (!wantKeep[i].has(j) || !wantKeep[j].has(i)) → xóa
```

**Tại sao "asymmetric delete" (OR thay vì AND)?**
```
AND: chỉ xóa khi CẢ 2 không muốn giữ → quá nhẹ tay, junction vẫn còn
OR:  xóa khi ÍT NHẤT 1 không muốn giữ → mạnh hơn nhưng:
     nếu i (sai hướng) không muốn giữ j (đúng hướng) → j vẫn bị xóa
     → an toàn vì nếu j đúng hướng, j sẽ được nối qua path khác
```

**Tác dụng:**  
Biến graph phức tạp (nhiều nhánh) thành chuỗi path-like (max degree = 2) — điều kiện tiên quyết để có thể walk theo thứ tự trong bước Order.

---

### Bước 6 — `get-Clusters-By-DFS.js`: DFS tìm Connected Components trên Graph

**Thuật toán:** Iterative DFS trên adjacency list  
**Độ phức tạp:** O(n + |edges|)

```js
const visited = new Uint8Array(n);
for (let i = 0; i < n; i++) {
  if (visited[i]) continue;
  // DFS từ i → lấy toàn bộ component liên thông
  const stack = [i];
  while (stack.length) {
    const u = stack.pop();
    for (const v of adj[u]) {
      if (!visited[v]) stack.push(v);
    }
  }
}
```

**Tương tự Bước 2 nhưng trên graph (không phải pixel grid).**

**Tác dụng:**  
Nhóm các dash thuộc cùng 1 nét chữ thành 1 **cluster**. Ví dụ chữ "X" có 2 cluster (2 nét chéo); chữ "i" có 2 cluster (thân + dấu chấm).

- Sau bước này ta biết "có bao nhiêu nét" và "mỗi nét gồm những dash nào".
- `filterSmallClusters(minSize=2)`: loại bỏ cluster có 1 dash (nhiễu sót sau prune).

---

### Bước 7 — `order-Cluster.js`: Greedy Spatial Walk + Nearest Neighbor Sweep

**Thuật toán:** Greedy Graph Walk với exit point tracking, fallback Nearest Neighbor Search  
**Độ phức tạp:** O(n) per cluster (walk) + O(n²) worst case (NNS fallback)

**4 bước trong thuật toán:**

```
Bước 1 — Tìm start:
  endpoints = dash có degree=1 trong cluster (đầu/cuối chuỗi)
  start = endpoint leftmost (x nhỏ nhất, tie-break y nhỏ nhất)
  Nếu không có endpoint (stroke vòng) → lấy leftmost trong cluster

Bước 2 — Greedy walk theo graph:
  exitPoint = endpoint nào của curr dash vừa "ra" khỏi
  next = neighbor chưa thăm, có endpoint gần exitPoint nhất
  → cập nhật exitPoint cho lần tiếp

Bước 3 — Fallback NNS (nếu còn dash chưa thăm do gap trong graph):
  nearest-neighbor sweep từ exitPoint cuối cùng

Bước 4 — Output: mảng dash.id theo thứ tự không gian
```

**Exit point tracking:**
```
Dash 0: entry=A  →  exit=B   (B gần dash 1 hơn)
Dash 1: entry=A  →  exit=B   (A gần B_0, B gần dash 2)
Dash 2: entry=B  →  exit=A   (B gần B_1, A là exit)
```

**Tác dụng:**  
Sắp xếp dash trong cluster thành chuỗi liên tục từ đầu đến cuối nét — để centerline không bị gãy/zigzag. Bước này quyết định trải nghiệm tô chữ có mượt mà không.

---

### Bước 8 — `build-Centerline-ForStroke.js`: Endpoint Chaining

**Thuật toán:** Sequential endpoint matching theo `prevPoint`  
**Độ phức tạp:** O(n) per cluster

```
Dash k=0: Nhìn dash k=1 để xác định chiều
  distBToNext < distAToNext → B là exit → start=A, end=B

Dash k>0: endpoint nào gần prevPoint hơn → là start
  distA < distB → start=A, end=B; prevPoint = end

Output: [A₀, B₀,  A₁, B₁,  A₂, B₂, ...]
         ↑──↑     ↑──↑     ↑──↑
         nét 0    nét 1    nét 2
              gap      gap
```

**Tác dụng:**  
Tạo polyline hoàn chỉnh để Phaser dùng làm "đường ray" khi bé tô chữ.

- Mỗi dash đóng góp đúng **2 điểm** → `polyline.length = dashIds.length × 2`
- **Khoảng gap giữa dash thể hiện tự nhiên** — bé phải "nhảy" qua gap bằng cách kéo tay qua vùng đó (không có nét guide), giúp phân biệt nét đứt với nét liền.

---

## Bảng tổng kết

| Bước | File | Thuật toán | Cấu trúc dữ liệu | Độ phức tạp | Tác dụng chính |
|------|------|-----------|------------------|-------------|----------------|
| 1 | `image-reader.js` | Grayscale Thresholding | `Uint8Array` | O(W×H) | RGBA → nhị phân 0/1 |
| 2 | `component-connect.js` | Flood Fill DFS 8-dir | Stack `[]`, `Uint8Array visited` | O(W×H) | Tách các blob pixel thành dash riêng lẻ |
| 3 | `compute-Dash-Feature.js` | PCA 2D | Plain object, `atan2` | O(N pixels) | Tính hướng + endpoint A, B sạch cho mỗi dash |
| 4 | `build-Dash-Graph.js` | KNN + Mutual Edge | `Set<number>[]` adj list | O(n²) | Nối các dash thành đồ thị theo hướng & khoảng cách |
| 5 | `prune-Junctions.js` | Score-based Asymmetric Prune | `Set` wantKeep, `Set` toDelete | O(n×deg) | Cắt nhánh sai, ép graph thành chain |
| 6 | `get-Clusters-By-DFS.js` | DFS Connected Components | Stack `[]`, `Uint8Array visited` | O(n+edges) | Nhóm dash cùng nét thành cluster |
| 7 | `order-Cluster.js` | Greedy Walk + NNS | `Set visited`, exit point | O(n) ~ O(n²) | Sắp xếp dash thành chuỗi không gian đúng thứ tự |
| 8 | `build-Centerline-ForStroke.js` | Endpoint Chaining | `Map<id,dash>`, `prevPoint` | O(n) | Tạo polyline [[x,y],...] cho Phaser runtime |

---

## Luồng dữ liệu End-to-End

```
letter_f_dashed.png
  │
  ▼ [image-reader]
  bin: Uint8Array(W×H)
  │
  ▼ [component-connect]
  comps: pixels[][]          ← mỗi phần tử = 1 blob pixel
  │
  ▼ [compute-Dash-Feature]
  dashes: DashFeature[]      ← centroid, dir, A, B, M, Ap, len
  │
  ▼ [build-Dash-Graph]
  adj: Set<number>[]         ← đồ thị kết nối dash
  │
  ▼ [prune-Junctions]
  adj (mutated)              ← max degree = 2, path-like
  │
  ▼ [get-Clusters-By-DFS]
  clusters: number[][]       ← nhóm dash theo nét
  │  [merge + filter]
  ▼ [order-Cluster]
  orderedIds: number[][]     ← dash.id theo thứ tự không gian
  │
  ▼ [build-Centerline-ForStroke]
  polyline: [x,y][]          ← 2 điểm mỗi dash → export JSON cho Phaser
```

---

## Điểm thiết kế nổi bật

| Quyết định | Lý do |
|-----------|-------|
| Dùng **stack tường minh** thay vì đệ quy cho DFS | Tránh stack overflow với ảnh lớn (>100K pixel/component) |
| **PCA** thay vì bounding box | Chính xác với nét nghiêng; không bị offset bởi pixel nhiễu |
| **Mutual edge filter** trong graph | Loại bỏ liên kết 1 chiều sai; giữ cấu trúc đối xứng |
| **Adaptive gapThreshold** (× median_len) | Tự thích nghi font chữ lớn/nhỏ; không cần hardcode |
| **Asymmetric prune** (OR thay vì AND) | An toàn: không làm đứt chuỗi hợp lệ |
| **Exit point tracking** trong Order | Không cần biết hướng toàn cục; xác định chiều đúng từng dash |
| **2 điểm mỗi dash** trong Centerline | Gap tự nhiên giữa dash thể hiện đúng nét đứt; bé "cảm" được khoảng ngắt |
