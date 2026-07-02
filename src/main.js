import "./style.css";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Firebase config from .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log("Firebase Project ID:", firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// HTML elements
const canvas = document.getElementById("jsCanvas");
const memoInput = document.getElementById("memoInput");
const postButton = document.getElementById("postButton");
const posts = document.getElementById("posts");

const colors = document.querySelectorAll(".control_color");
const colorPicker = document.getElementById("colorPicker");
const brushStyle = document.getElementById("brushStyle");
const brushSize = document.getElementById("brushSize");

// Safety check
if (!canvas || !memoInput || !postButton || !posts) {
  console.error("Required HTML elements are missing. Check jsCanvas, memoInput, postButton, posts.");
}

// Canvas setup
const brush = canvas.getContext("2d");

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width;
  canvas.height = rect.height;

  brush.lineWidth = 5;
  brush.strokeStyle = "green";
  brush.lineCap = "round";
}

resizeCanvas();

let painting = false;
let currentTool = "pen";
let currentBrushSize = 5;
let editingPostId = null;

function startBrush(event) {
  painting = true;
  brush.beginPath();
  brush.moveTo(event.offsetX, event.offsetY);
}

function stopPainting() {
  painting = false;
}

function draw(event) {
  if (!painting) return;

  if (currentTool === "pen") {
    brush.globalAlpha = 1;
    brush.lineWidth = currentBrushSize;
    brush.lineCap = "round";
    brush.globalCompositeOperation = "source-over";
  }

  if (currentTool === "pencil") {
    brush.globalAlpha = 0.4;
    brush.lineWidth = currentBrushSize;
    brush.lineCap = "round";
    brush.globalCompositeOperation = "source-over";
  }

  if (currentTool === "brush") {
    brush.globalAlpha = 0.25;
    brush.lineWidth = currentBrushSize;
    brush.lineCap = "round";
    brush.globalCompositeOperation = "source-over";
  }

  if (currentTool === "eraser") {
    brush.globalAlpha = 1;
    brush.lineWidth = currentBrushSize;
    brush.globalCompositeOperation = "destination-out";
  }

  brush.lineTo(event.offsetX, event.offsetY);
  brush.stroke();
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

// Canvas events
canvas.addEventListener("mousedown", startBrush);
canvas.addEventListener("mouseup", stopPainting);
canvas.addEventListener("mouseleave", stopPainting);
canvas.addEventListener("mousemove", draw);

// Color events
colors.forEach((color) => {
  color.addEventListener("click", function (event) {
    const selected = event.target.style.backgroundColor;
    brush.strokeStyle = selected;
  });
});

if (colorPicker) {
  colorPicker.addEventListener("input", function (event) {
    brush.strokeStyle = event.target.value;
  });
}

// Brush events
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

// Firebase create/update post
async function createPost() {
  try {
    const memo = memoInput.value.trim();

    if (memo === "") {
      alert("Please write a memo first.");
      return;
    }

    const imageData = canvas.toDataURL("image/png");

    console.log("Posting...");
    console.log("Firebase Project ID:", firebaseConfig.projectId);
    console.log("Image size:", imageData.length);

    if (editingPostId) {
      const postRef = doc(db, "posts", editingPostId);

      await updateDoc(postRef, {
        memo: memo,
        image: imageData,
        updatedAt: serverTimestamp()
      });

      editingPostId = null;
      postButton.textContent = "Post";
    } else {
      const docRef = await addDoc(collection(db, "posts"), {
        memo: memo,
        image: imageData,
        createdAt: serverTimestamp()
      });

      console.log("Post created:", docRef.id);
    }

    memoInput.value = "";
    clearCanvas();
  } catch (error) {
    console.error("Post failed:", error);
    alert(error.message);
  }
}

// Firebase read posts
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

        if (data.createdAt) {
          date.textContent = data.createdAt.toDate().toLocaleString();
        } else {
          date.textContent = "Posting...";
        }

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
            behavior: "smooth"
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

//for the visitor graph
const visitorCanvas = document.getElementById("visitorChart");

if (visitorCanvas && typeof Chart !== "undefined") {
  new Chart(visitorCanvas, {
    type: "line",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [
        {
          label: "Visitors",
          data: [3, 5, 2, 8, 6, 10, 7],
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          ticks: {
            font: {
              size: 10,
            },
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            font: {
              size: 10,
            },
          },
        },
      },
    },
  });
}

const visitorFloating = document.querySelector(".visitor-floating");
const visitorButton = document.querySelector(".visitor-circle");

if (visitorFloating && visitorButton) {
  visitorButton.addEventListener("click", (event) => {
    event.stopPropagation();
    visitorFloating.classList.toggle("is-open");
  });

  document.addEventListener("click", (event) => {
    const clickedInsideVisitor = visitorFloating.contains(event.target);

    if (!clickedInsideVisitor) {
      visitorFloating.classList.remove("is-open");
    }
  });
}