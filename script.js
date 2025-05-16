// ✅ 修复后的 script.js 文件（含手机 touch 支持）
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let backgroundImage = null;
let overlayImage = null;
let overlayData = null;
let historyStack = [];
let isErasing = false;
let isTransforming = false;

let currentHandle = null;
const handleSize = 10;

let overlayTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  dragging: false,
  offsetX: 0,
  offsetY: 0
};

let lastTouchDistance = null;
let lastTouchAngle = null;
let lastMidpoint = null;

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
  overlayTransform.dragging = true;
  overlayTransform.offsetX = e.clientX - overlayTransform.x;
  overlayTransform.offsetY = e.clientY - overlayTransform.y;
});

canvas.addEventListener("mousemove", (e) => {
  if (!isTransforming || !overlayTransform.dragging) return;
  overlayTransform.x = e.clientX - overlayTransform.offsetX;
  overlayTransform.y = e.clientY - overlayTransform.offsetY;
  drawCanvas();
});

canvas.addEventListener("mouseup", () => {
  overlayTransform.dragging = false;
});

canvas.addEventListener("mouseleave", () => {
  overlayTransform.dragging = false;
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

// ✅ 手机双指缩放旋转 + 单指移动
canvas.addEventListener("touchstart", (e) => {
  if (!isTransforming) return;
  if (e.touches.length === 1) {
    overlayTransform.dragging = true;
    overlayTransform.offsetX = e.touches[0].clientX - overlayTransform.x;
    overlayTransform.offsetY = e.touches[0].clientY - overlayTransform.y;
  } else if (e.touches.length === 2) {
    const [p1, p2] = e.touches;
    lastTouchDistance = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
    lastTouchAngle = Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX);
    lastMidpoint = {
      x: (p1.clientX + p2.clientX) / 2,
      y: (p1.clientY + p2.clientY) / 2
    };
  }
});

canvas.addEventListener("touchmove", (e) => {
  if (!isTransforming) return;
  e.preventDefault();
  if (e.touches.length === 1 && overlayTransform.dragging) {
    overlayTransform.x = e.touches[0].clientX - overlayTransform.offsetX;
    overlayTransform.y = e.touches[0].clientY - overlayTransform.offsetY;
    drawCanvas();
  } else if (e.touches.length === 2) {
    const [p1, p2] = e.touches;
    const newDistance = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
    const newAngle = Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX);

    if (lastTouchDistance && lastTouchAngle) {
      overlayTransform.scale *= newDistance / lastTouchDistance;
      overlayTransform.rotation += newAngle - lastTouchAngle;
    }

    lastTouchDistance = newDistance;
    lastTouchAngle = newAngle;
    drawCanvas();
  }
}, { passive: false });

canvas.addEventListener("touchend", () => {
  overlayTransform.dragging = false;
  lastTouchDistance = null;
  lastTouchAngle = null;
});

function loadImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = URL.createObjectURL(file);
  });
}

function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (backgroundImage) ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

  if (overlayImage && !overlayData) {
    ctx.drawImage(overlayImage, 0, 0, canvas.width, canvas.height);
    overlayData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
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
