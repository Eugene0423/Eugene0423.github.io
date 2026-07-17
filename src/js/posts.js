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
  limit,
} from "./firebase.js";

import { logSecurityEvent } from "./security.js";
import { hasBlockedAdminField } from "./security.js";

export function setupPosts(canvasBoard) {
  const {
    canvas,
    memoInput,
    loadImageToCanvas,
    getCanvasImage,
    clearCanvas,
    MAX_CANVAS_DATA_SIZE,
  } = canvasBoard;

  const postButton = document.getElementById("postButton");
  const posts = document.getElementById("posts");

  let editingPostId = null;

  if (!postButton || !posts) {
    console.warn("Post elements not found.");
    return;
  }

  async function createPost() {
    const memo = memoInput.value.trim();
    const image = getCanvasImage();

    const postData = {
      memo,
      image,
    };

    if (await hasBlockedAdminField(postData)) {
      alert("Blocked field detected.");
      return;
    }

    if (image.length > MAX_CANVAS_DATA_SIZE) {
      alert("Canvas image is too large.");

      await logSecurityEvent(
        "Canvas size blocked",
        "medium",
        "Canvas data exceeded the allowed size.",
        { imageSize: image.length }
      );

      return;
    }

    try {
      if (editingPostId) {
        await updateDoc(doc(db, "posts", editingPostId), {
          memo,
          image,
          updatedAt: serverTimestamp(),
        });

        editingPostId = null;
        postButton.textContent = "Post";
      } else {
        await addDoc(collection(db, "posts"), {
          memo,
          image,
          createdAt: serverTimestamp(),
        });
      }

      memoInput.value = "";
      clearCanvas();
    } catch (error) {
      console.error("Post save failed:", error);
      alert(error.message);
    }
  }

  function showPosts() {
    const postsQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    onSnapshot(
      postsQuery,
      (snapshot) => {
        posts.innerHTML = "";

        snapshot.forEach((firebaseDoc) => {
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

          editButton.addEventListener("click", () => {
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

          deleteButton.addEventListener("click", async () => {
            const confirmDelete = confirm("Delete this post?");

            if (!confirmDelete) return;

            try {
              await deleteDoc(doc(db, "posts", postId));
            } catch (error) {
              console.error("Delete failed:", error);
              alert(error.message);

              await logSecurityEvent(
                "Delete post failed",
                "medium",
                "Failed to delete post.",
                { postId }
              );
            }
          });

          buttonBox.append(editButton, deleteButton);
          post.append(img, memo, date, buttonBox);
          posts.appendChild(post);
        });
      },
      (error) => {
        console.error("Realtime listener failed:", error);
        alert(error.message);
      }
    );
  }

  postButton.addEventListener("click", createPost);

  showPosts();
}