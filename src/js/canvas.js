export function setupCanvasBoard() {
  const canvas = document.getElementById("jsCanvas");
  const memoInput = document.getElementById("memoInput");

  const colors = document.querySelectorAll(".control_color");
  const colorPicker = document.getElementById("colorPicker");
  const brushStyle = document.getElementById("brushStyle");
  const brushSize = document.getElementById("brushSize");

  if (!canvas || !memoInput) {
    console.warn("Canvas board elements not found.");
    return null;
  }

  const brush = canvas.getContext("2d");

  let painting = false;
  let currentTool = "pen";
  let currentBrushSize = 5;

  const MAX_CANVAS_DATA_SIZE = 900000;

  canvas.style.touchAction = "none";

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const oldImage = canvas.toDataURL();

    canvas.width = rect.width;
    canvas.height = rect.height;

    brush.lineWidth = currentBrushSize;
    brush.strokeStyle = "green";
    brush.lineCap = "round";

    const img = new Image();

    img.onload = function () {
      brush.drawImage(img, 0, 0, canvas.width, canvas.height);
    };

    img.src = oldImage;
  }

  function getCanvasPosition(event) {
    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function applyToolStyle() {
    brush.lineWidth = currentBrushSize;
    brush.lineCap = "round";

    if (currentTool === "pen") {
      brush.globalAlpha = 1;
      brush.globalCompositeOperation = "source-over";
    } else if (currentTool === "pencil") {
      brush.globalAlpha = 0.4;
      brush.globalCompositeOperation = "source-over";
    } else if (currentTool === "brush") {
      brush.globalAlpha = 0.25;
      brush.globalCompositeOperation = "source-over";
    } else if (currentTool === "eraser") {
      brush.globalAlpha = 1;
      brush.globalCompositeOperation = "destination-out";
    }
  }

  function startBrush(event) {
    event.preventDefault();
    painting = true;

    if (canvas.setPointerCapture) {
      canvas.setPointerCapture(event.pointerId);
    }

    const pos = getCanvasPosition(event);

    brush.beginPath();
    brush.moveTo(pos.x, pos.y);
  }

  function draw(event) {
    if (!painting) return;

    event.preventDefault();

    const pos = getCanvasPosition(event);

    applyToolStyle();

    brush.lineTo(pos.x, pos.y);
    brush.stroke();
  }

  function stopPainting(event) {
    painting = false;
    brush.beginPath();

    if (event && canvas.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture가 이미 해제된 경우 무시
      }
    }
  }

  function clearCanvas() {
    brush.clearRect(0, 0, canvas.width, canvas.height);
  }

  function loadImageToCanvas(imageSrc) {
    const img = new Image();

    img.onload = function () {
      clearCanvas();

      brush.globalAlpha = 1;
      brush.globalCompositeOperation = "source-over";
      brush.drawImage(img, 0, 0, canvas.width, canvas.height);
    };

    img.src = imageSrc;
  }

  function getCanvasImage() {
    return canvas.toDataURL("image/png");
  }

  resizeCanvas();

  window.addEventListener("resize", resizeCanvas);

  canvas.addEventListener("pointerdown", startBrush);
  canvas.addEventListener("pointermove", draw);
  canvas.addEventListener("pointerup", stopPainting);
  canvas.addEventListener("pointerleave", stopPainting);
  canvas.addEventListener("pointercancel", stopPainting);

  colors.forEach((color) => {
    color.addEventListener("click", function (event) {
      brush.strokeStyle = event.target.style.backgroundColor;
    });
  });

  colorPicker?.addEventListener("input", function (event) {
    brush.strokeStyle = event.target.value;
  });

  brushStyle?.addEventListener("change", function (event) {
    currentTool = event.target.value;
  });

  brushSize?.addEventListener("input", function (event) {
    currentBrushSize = Number(event.target.value);
  });

  return {
    canvas,
    memoInput,
    loadImageToCanvas,
    getCanvasImage,
    clearCanvas,
    MAX_CANVAS_DATA_SIZE,
  };
}