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

// Test Scenario: Normal logged-in user attempting to create post with admin realated field.
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
  setDoc(doc(normalDb, "posts", "blocked-field-post"), {
    memo: "test",
    image: "test",
    createdAt: new Date(),
    role: "admin",
  })
);

console.log("PASS: 일반 사용자의 admin 필드 생성이 차단됨");

await testEnv.cleanup();
