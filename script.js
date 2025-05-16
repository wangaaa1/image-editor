const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let backgroundImage = null;
let overlayImage = null;
let overlayData = null;
let historyStack = [];
let isErasing = false;

const backgroundInput = document.getElementById("backgroundInput");
const overlayInput = document.getElementById("overlayInput");
const eraseButton = document.getElementById("eraseButton");
const undoButton = document.getElementById("undoButton");

// 上传背景图
backgroundInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const img = await loadImage(file);
  backgroundImage = img;
  document.getElementById("backgroundThumb").src = img.src;

  // 设置 canvas 尺寸为图片原始尺寸
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  // 清除之前的 overlayData（防止旧图大小不一致）
  overlayData = null;
  overlayImage = null;
  document.getElementById("overlayThumb").src = "";

  drawCanvas();
});

// 上传文字图
overlayInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const img = await loadImage(file);
  overlayImage = img;
  document.getElementById("overlayThumb").src = img.src;
  drawCanvas();
});

// 点击画布进行颜色擦除（连通区域）
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

// 切换“颜色擦除”按钮状态
eraseButton.addEventListener("click", () => {
  isErasing = !isErasing;
  eraseButton.classList.toggle("active", isErasing);
});

// 撤销上一步
undoButton.addEventListener("click", () => {
  if (historyStack.length > 0) {
    overlayData = historyStack.pop();
    drawCanvas();
  }
});

// 加载图像
function loadImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = URL.createObjectURL(file);
  });
}

// 绘制画布：先画背景，再叠加透明的文字图层
function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 画背景图
  if (backgroundImage) {
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
  }

  // 初次上传文字图时初始化 overlayData
  if (overlayImage && !overlayData) {
    ctx.drawImage(overlayImage, 0, 0, canvas.width, canvas.height);
    overlayData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  // 如果有文字图数据，用透明图层叠加上去
  if (overlayData) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.putImageData(overlayData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0);
  }
}

// 用泛洪算法擦除点击位置连通区域
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
    const diff = Math.sqrt(
      (r - targetRGB[0]) ** 2 +
      (g - targetRGB[1]) ** 2 +
      (b - targetRGB[2]) ** 2
    );
    return diff <= tolerance;
  }

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const key = `${x},${y}`;
    if (visited.has(key) || x < 0 || y < 0 || x >= width || y >= height) continue;

    const idx = getIndex(x, y);
    if (colorMatch(idx)) {
      data[idx + 3] = 0; // 设置 alpha = 0（透明）
      visited.add(key);

      // 加入相邻像素
      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
  }
}

// 存储历史记录（用于撤销）
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
// 下载按钮功能：导出合成图像为 PNG
const downloadButton = document.getElementById("downloadButton");

downloadButton.addEventListener("click", () => {
  const dataURL = canvas.toDataURL("image/png");
  document.getElementById("previewImage").src = dataURL;
  document.getElementById("previewBox").style.display = "flex";
  alert("⏬ 请长按图像，选择“保存到相册”");
});
document.getElementById("previewBox").addEventListener("click", () => {
  document.getElementById("previewBox").style.display = "none";
});
