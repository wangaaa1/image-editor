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

backgroundInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const img = await loadImage(file);
  backgroundImage = img;
  document.getElementById("backgroundThumb").src = img.src;
  drawCanvas();
});

overlayInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const img = await loadImage(file);
  overlayImage = img;
  document.getElementById("overlayThumb").src = img.src;
  drawCanvas();
});

canvas.addEventListener("click", (e) => {
  if (!isErasing || !overlayData) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) * canvas.width / rect.width);
  const y = Math.floor((e.clientY - rect.top) * canvas.height / rect.height);

  saveHistory();

  const pixelIndex = (y * canvas.width + x) * 4;
  const targetColor = overlayData.data.slice(pixelIndex, pixelIndex + 3);

  eraseSimilarColor(targetColor);
  drawCanvas();
});

eraseButton.addEventListener("click", () => {
  isErasing = !isErasing;
  eraseButton.style.background = isErasing ? "#0077aa" : "#00a2d4";
});

undoButton.addEventListener("click", () => {
  if (historyStack.length > 0) {
    overlayData = historyStack.pop();
    drawCanvas();
  }
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
  if (backgroundImage) {
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
  }
  if (overlayImage && !overlayData) {
    ctx.drawImage(overlayImage, 0, 0, canvas.width, canvas.height);
    overlayData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  } else if (overlayData) {
    ctx.putImageData(overlayData, 0, 0);
  }
}

function eraseSimilarColor(targetRGB) {
  const data = overlayData.data;
  const tolerance = 20;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const diff = Math.sqrt(
      (r - targetRGB[0]) ** 2 +
      (g - targetRGB[1]) ** 2 +
      (b - targetRGB[2]) ** 2
    );

    if (diff <= tolerance) {
      data[i + 3] = 0; // 设置 alpha = 0，透明
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
