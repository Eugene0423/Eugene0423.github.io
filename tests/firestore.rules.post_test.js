import fs from "fs";

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";

import {
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";

const testEnv = await initializeTestEnvironment({
  projectId: "my-portofolio-5e250",
  firestore: {
    rules: fs.readFileSync("firestore.rules", "utf8"),
  },
});

await testEnv.withSecurityRulesDisabled(async (context) => {
  await setDoc(
    doc(context.firestore(), "posts", "test-post"),
    {
      memo: "test",
      image: "test",
      createdAt: new Date(),
    }
  );
});

// Test Scenario: The user has logged-out from the account but attempts to delete the post
const guestDb =
  testEnv.unauthenticatedContext().firestore();

await assertFails(
  deleteDoc(doc(guestDb, "posts", "test-post"))
);

console.log("PASS: 로그아웃 사용자의 삭제가 차단됨");

// Test Scenario: The admin is attempting to delete the post.
await testEnv.withSecurityRulesDisabled(async (context) => {
  await setDoc(
    doc(context.firestore(), "posts", "admin-test-post"),
    {
      memo: "test",
      image: "test",
      createdAt: new Date(),
    }
  );
});

const adminDb = testEnv
  .authenticatedContext("WXFlUlg1GgeUAMOCxVofg2tcbiE3")
  .firestore();

await assertSucceeds(
  deleteDoc(doc(adminDb, "posts", "admin-test-post"))
);

console.log("PASS: 관리자는 post 삭제 가능");

// Test Scenario: Normal logged-in user attempting to delete, block deleteing the post.
await testEnv.withSecurityRulesDisabled(async (context) =>{
  await setDoc(
    doc(context.firestore(), "posts", "normal-login-post"),
    {
      memo: "test",
      image: "test",
      createdAt: new Date(),
    }
  );
});

const normalDb = testEnv.authenticatedContext("normaluseruid").firestore();

await assertFails(
  deleteDoc(doc(normalDb, "posts", "normal-login-post"))
);

console.log("PASS: 일반 사용자는 불과한 능력 확인");

await testEnv.cleanup();
