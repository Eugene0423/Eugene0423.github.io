import {
  db,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
} from "./firebase.js";

export function setupCanvasBoard() {
  const canvas = document.getElementById("jsCanvas");
  const memoInput = document.getElementById("memoInput");
  const postButton = document.getElementById("postButton");
  const posts = document.getElementById("posts");

  const colors = document.querySelectorAll(".control_color");
  const colorPicker = document.getElementById("colorPicker");
  const brushStyle = document.getElementById("brushStyle");
  const brushSize = document.getElementById("brushSize");

  if (!canvas || !memoInput || !postButton || !posts) {
    console.warn("Canvas board elements not found.");
    return;
  }

  const brush = canvas.getContext("2d");

  let painting = false;
  let currentTool = "pen";
  let currentBrushSize = 5;
  let editingPostId = null;

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
      } catch (error) {
        // ignore release errors
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

  if (colorPicker) {
    colorPicker.addEventListener("input", function (event) {
      brush.strokeStyle = event.target.value;
    });
  }

  if (brushStyle) {
    brushStyle.addEventListener("change", function (event) {
      currentTool = event.target.value;
    });
  }

  if (brushSize) {
    brushSize.addEventListener("input", function (event) {
      currentBrushSize = Number(event.target.value);
    });
  }

  async function createPost() {
    try {
      const memo = memoInput.value.trim();

      if (memo === "") {
        alert("Please write a memo first.");
        return;
      }

      const imageData = canvas.toDataURL("image/png");

      if (editingPostId) {
        const postRef = doc(db, "posts", editingPostId);

        await updateDoc(postRef, {
          memo,
          image: imageData,
          updatedAt: serverTimestamp(),
        });

        editingPostId = null;
        postButton.textContent = "Post";
      } else {
        await addDoc(collection(db, "posts"), {
          memo,
          image: imageData,
          createdAt: serverTimestamp(),
        });
      }

      memoInput.value = "";
      clearCanvas();
    } catch (error) {
      console.error("Post failed:", error);
      alert(error.message);
    }
  }

  function showPosts() {
    const postsQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc")
    );

    onSnapshot(
      postsQuery,
      function (snapshot) {
        posts.innerHTML = "";

        snapshot.forEach(function (firebaseDoc) {
          const data = firebaseDoc.data();
          const postId = firebaseDoc.id;

          const post = document.createElement("div");
          post.className = "post";

          const img = document.createElement("img");
          img.src = data.image;

          const memo = document.createElement("p");
          memo.textContent = data.memo;

          const date = document.createElement("small");
          date.textContent = data.createdAt
            ? data.createdAt.toDate().toLocaleString()
            : "Posting...";

          const buttonBox = document.createElement("div");
          buttonBox.className = "post-buttons";

          const editButton = document.createElement("button");
          editButton.textContent = "Edit";

          editButton.addEventListener("click", function () {
            editingPostId = postId;
            memoInput.value = data.memo;
            postButton.textContent = "Update";
            loadImageToCanvas(data.image);

            window.scrollTo({
              top: canvas.offsetTop - 100,
              behavior: "smooth",
            });
          });

          const deleteButton = document.createElement("button");
          deleteButton.textContent = "Delete";

          deleteButton.addEventListener("click", async function () {
            const confirmDelete = confirm("Delete this post?");

            if (confirmDelete) {
              try {
                await deleteDoc(doc(db, "posts", postId));
              } catch (error) {
                console.error("Delete failed:", error);
                alert(error.message);
              }
            }
          });

          buttonBox.appendChild(editButton);
          buttonBox.appendChild(deleteButton);

          post.appendChild(img);
          post.appendChild(memo);
          post.appendChild(date);
          post.appendChild(buttonBox);

          posts.appendChild(post);
        });
      },
      function (error) {
        console.error("Realtime listener failed:", error);
        alert(error.message);
      }
    );
  }

  postButton.addEventListener("click", createPost);

  showPosts();
}