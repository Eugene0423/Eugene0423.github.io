import { auth } from "./firebase.js";

import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from
  "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const googleProvider = new GoogleAuthProvider();

const adminLoginButton =
  document.getElementById("adminLoginButton");

const adminLogoutButton =
  document.getElementById("adminLogoutButton");

adminLoginButton?.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(
      auth,
      googleProvider
    );

    console.log("로그인 성공");
    console.log("UID:", result.user.uid);
    console.log("이메일:", result.user.email);
  } catch (error) {
    console.error(
      "로그인 실패:",
      error.code,
      error.message
    );
  }
});

adminLogoutButton?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    console.log("로그아웃됨");
  } catch (error) {
    console.error("로그아웃 실패:", error);
  }
});

onAuthStateChanged(auth, (user) => {
  const isLoggedIn = Boolean(user);

  console.log(
    isLoggedIn
      ? "Firebase 로그인됨"
      : "Firebase 로그인 안 됨"
  );

  if (user) {
    console.log("현재 UID:", user.uid);
  }

  if (adminLoginButton) {
    adminLoginButton.hidden = isLoggedIn;
  }

  if (adminLogoutButton) {
    adminLogoutButton.hidden = !isLoggedIn;
  }
});