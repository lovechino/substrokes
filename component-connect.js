function connectedComponents(bin, width, height, minArea = 10) {
  const visited = new Uint8Array(bin.length);
  const components = [];

  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1]
  ];

  const idx = (x, y) => y * width + x;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {

      const i = idx(x, y);

      if (bin[i] === 1 && !visited[i]) {

        const stack = [[x, y]];
        visited[i] = 1;
        const pixels = [];

        while (stack.length) {
          const [cx, cy] = stack.pop();
          pixels.push({ x: cx, y: cy });

          for (const [dx, dy] of dirs) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (nx < 0 || ny < 0 || nx >= width || ny >= height)
              continue;

            const ni = idx(nx, ny);

            if (bin[ni] === 1 && !visited[ni]) {
              visited[ni] = 1;
              stack.push([nx, ny]);
            }
          }
        }

        if (pixels.length >= minArea) {
          components.push(pixels);
        }
      }
    }
  }

  return components;
}

module.exports = connectedComponents;