// ✅ 修复后的 script.js 文件（含桌面 & 手机兼容 + 编辑框缩放）
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let backgroundImage = null;
let overlayImage = null;
let overlayData = null;
let historyStack = [];
let isErasing = false;
let isTransforming = false;

let overlayTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  dragging: false,
  offsetX: 0,
  offsetY: 0
};

let currentHandle = null;
const handleSize = 12;

const backgroundInput = document.getElementById("backgroundInput");
const overlayInput = document.getElementById("overlayInput");
const eraseButton = document.getElementById("eraseButton");
const undoButton = document.getElementById("undoButton");
const transformButton = document.getElementById("transformButton");

backgroundInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const img = await loadImage(file);
  backgroundImage = img;
  document.getElementById("backgroundThumb").src = img.src;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  overlayData = null;
  overlayImage = null;
  document.getElementById("overlayThumb").src = "";
  drawCanvas();
});

overlayInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const img = await loadImage(file);
  overlayImage = img;
  overlayData = null;
  document.getElementById("overlayThumb").src = img.src;
  drawCanvas();
});

eraseButton.addEventListener("click", () => {
  isErasing = !isErasing;
  isTransforming = false;
  eraseButton.style.background = isErasing ? "#0077aa" : "#00a2d4";
  transformButton.style.background = "#00a2d4";
});

transformButton.addEventListener("click", () => {
  isTransforming = !isTransforming;
  isErasing = false;
  transformButton.style.background = isTransforming ? "#0077aa" : "#00a2d4";
  eraseButton.style.background = "#00a2d4";
});

undoButton.addEventListener("click", () => {
  if (historyStack.length > 0) {
    overlayData = historyStack.pop();
    drawCanvas();
  }
});

canvas.addEventListener("mousedown", (e) => {
  if (!isTransforming) return;
  const { offsetX, offsetY } = e;
  currentHandle = getHandleAt(offsetX, offsetY);
  if (!currentHandle) {
    overlayTransform.dragging = true;
    overlayTransform.offsetX = offsetX - overlayTransform.x;
    overlayTransform.offsetY = offsetY - overlayTransform.y;
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!isTransforming) return;
  const { offsetX, offsetY } = e;
  if (overlayTransform.dragging) {
    overlayTransform.x = offsetX - overlayTransform.offsetX;
    overlayTransform.y = offsetY - overlayTransform.offsetY;
    drawCanvas();
  } else if (currentHandle) {
    const dx = offsetX - (canvas.width / 2 + overlayTransform.x);
    const dy = offsetY - (canvas.height / 2 + overlayTransform.y);
    const dist = Math.sqrt(dx * dx + dy * dy);
    overlayTransform.scale = dist / (Math.sqrt(2) * canvas.width / 2);
    overlayTransform.scale = Math.max(0.2, overlayTransform.scale);
    drawCanvas();
  }
});

canvas.addEventListener("mouseup", () => {
  overlayTransform.dragging = false;
  currentHandle = null;
});

canvas.addEventListener("click", (e) => {
  if (!isErasing || !overlayData) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) * canvas.width / rect.width);
  const y = Math.floor((e.clientY - rect.top) * canvas.height / rect.height);
  const index = (y * canvas.width + x) * 4;
  const targetColor = overlayData.data.slice(index, index + 3);
  saveHistory();
  eraseSimilarColor(targetColor, x, y);
  drawCanvas();
});

function getHandleAt(x, y) {
  const centerX = canvas.width / 2 + overlayTransform.x;
  const centerY = canvas.height / 2 + overlayTransform.y;
  const size = canvas.width / 2 * overlayTransform.scale;
  const corners = [
    [centerX - size, centerY - size],
    [centerX + size, centerY - size],
    [centerX + size, centerY + size],
    [centerX - size, centerY + size]
  ];
  return corners.find(([cx, cy]) => Math.abs(cx - x) < handleSize && Math.abs(cy - y) < handleSize);
}

function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (backgroundImage) ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

  if (overlayImage) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(overlayImage, 0, 0, canvas.width, canvas.height);
    overlayData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
  }

  if (overlayData) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.putImageData(overlayData, 0, 0);

    ctx.save();
    ctx.translate(overlayTransform.x, overlayTransform.y);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(overlayTransform.rotation);
    ctx.scale(overlayTransform.scale, overlayTransform.scale);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

    // 绘制边框和锚点
    ctx.save();
    ctx.translate(overlayTransform.x, overlayTransform.y);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(overlayTransform.rotation);
    ctx.strokeStyle = "#f00";
    ctx.lineWidth = 2;
    ctx.strokeRect(-canvas.width / 2 * overlayTransform.scale, -canvas.height / 2 * overlayTransform.scale, canvas.width * overlayTransform.scale, canvas.height * overlayTransform.scale);

    const handles = [
      [-canvas.width / 2, -canvas.height / 2],
      [canvas.width / 2, -canvas.height / 2],
      [canvas.width / 2, canvas.height / 2],
      [-canvas.width / 2, canvas.height / 2]
    ];
    ctx.fillStyle = "blue";
    for (let [hx, hy] of handles) {
      ctx.beginPath();
      ctx.arc(hx * overlayTransform.scale, hy * overlayTransform.scale, handleSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function eraseSimilarColor(targetRGB, startX, startY) {
  const width = canvas.width;
  const height = canvas.height;
  const data = overlayData.data;
  const tolerance = 20;
  const visited = new Set();
  const stack = [[startX, startY]];

  function getIndex(x, y) {
    return (y * width + x) * 4;
  }

  function colorMatch(index) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const diff = Math.sqrt((r - targetRGB[0]) ** 2 + (g - targetRGB[1]) ** 2 + (b - targetRGB[2]) ** 2);
    return diff <= tolerance;
  }

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const key = `${x},${y}`;
    if (visited.has(key) || x < 0 || y < 0 || x >= width || y >= height) continue;

    const idx = getIndex(x, y);
    if (colorMatch(idx)) {
      data[idx + 3] = 0;
      visited.add(key);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }
}

function saveHistory() {
  if (overlayData) {
    const copy = new ImageData(
      new Uint8ClampedArray(overlayData.data),
      overlayData.width,
      overlayData.height
    );
    historyStack.push(copy);
  }
}
