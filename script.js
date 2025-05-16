// ✅ 修复后的 script.js 文件
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
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (isTransforming) {
    const centerX = canvas.width / 2 + overlayTransform.x;
    const centerY = canvas.height / 2 + overlayTransform.y;
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const angle = -overlayTransform.rotation;
    const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ry = dx * Math.sin(angle) + dy * Math.cos(angle);

    const handles = {
      tl: [-canvas.width / 2, -canvas.height / 2],
      tr: [canvas.width / 2, -canvas.height / 2],
      br: [canvas.width / 2, canvas.height / 2],
      bl: [-canvas.width / 2, canvas.height / 2]
    };

    for (const [key, [hx, hy]] of Object.entries(handles)) {
      if (Math.abs(rx - hx * overlayTransform.scale) < handleSize &&
          Math.abs(ry - hy * overlayTransform.scale) < handleSize) {
        currentHandle = key;
        return;
      }
    }

    overlayTransform.dragging = true;
    overlayTransform.offsetX = e.clientX - overlayTransform.x;
    overlayTransform.offsetY = e.clientY - overlayTransform.y;
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!isTransforming) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (currentHandle) {
    const centerX = canvas.width / 2 + overlayTransform.x;
    const centerY = canvas.height / 2 + overlayTransform.y;
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    overlayTransform.scale = dist / (Math.sqrt(2) * canvas.width / 2);
    overlayTransform.scale = Math.max(0.1, overlayTransform.scale);

    if (e.ctrlKey) {
      overlayTransform.rotation = Math.atan2(dy, dx);
    }

    drawCanvas();
    return;
  }

  if (overlayTransform.dragging) {
    overlayTransform.x = e.clientX - overlayTransform.offsetX;
    overlayTransform.y = e.clientY - overlayTransform.offsetY;
    drawCanvas();
  }
});

canvas.addEventListener("mouseup", () => {
  overlayTransform.dragging = false;
  currentHandle = null;
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

    const handles = {
      tl: [0, 0],
      tr: [canvas.width, 0],
      br: [canvas.width, canvas.height],
      bl: [0, canvas.height]
    };

    for (const [key, [hx, hy]] of Object.entries(handles)) {
      ctx.beginPath();
      ctx.fillStyle = "blue";
      ctx.arc(hx, hy, handleSize, 0, Math.PI * 2);
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
