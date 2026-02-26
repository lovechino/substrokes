const sharp = require("sharp");

/**
 * Đọc ảnh PNG và chuyển thành mảng nhị phân (bin).
 * bin[i] = 1  → pixel là nét (tối)
 * bin[i] = 0  → pixel là nền (sáng / trong suốt)
 *
 * @param {string} path - đường dẫn file ảnh
 * @param {object} opts
 * @param {number} opts.grayThreshold - ngưỡng độ xám (0-255), pixel tối hơn ngưỡng = nét (mặc định 128)
 * @param {number} opts.alphaThreshold - pixel alpha < ngưỡng này → coi là nền (mặc định 10)
 */
async function loadBinaryImage(path, opts = {}) {
  const {
    grayThreshold = 128,  // pixel gray < ngưỡng → nét đen
    alphaThreshold = 30  // pixel alpha < ngưỡng → trong suốt → bỏ qua
  } = opts;

  const { data, info } = await sharp(path)
    .ensureAlpha()        // đảm bảo luôn có kênh alpha (RGBA)
    // .greyscale()
    .linear(2.0, -80)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info; // channels = 4 (RGBA)

  const bin = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels + 0];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];
    const a = data[i * channels + 3];

    // Pixel trong suốt → nền, bỏ qua
    if (a < alphaThreshold) {
      bin[i] = 0;
      continue;
    }

    // Tính độ xám
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    // Pixel tối → nét (= 1), pixel sáng → nền (= 0)
    bin[i] = gray < grayThreshold ? 1 : 0;
  }

  return { bin, width, height };
}

module.exports = loadBinaryImage;