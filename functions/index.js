/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const { onCall, HttpsError } = require(
  "firebase-functions/v2/https"
);

const { GoogleGenAI } = require("@google/genai");

exports.moderatePost = onCall(async (request) => {
  const memo = request.data?.memo;

  if (typeof memo !== "string" || memo.trim() === "") {
    throw new HttpsError(
      "invalid-argument",
      "게시물 내용을 입력해주세요."
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new HttpsError(
      "failed-precondition",
      "Gemini API 키가 설정되지 않았습니다."
    );
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
다음 게시물에 욕설, 모욕, 비방, 괴롭힘, 혐오 또는 협박이 포함되어 있는지 판단하세요.

반드시 아래 JSON 형식으로만 답하세요.

{
  "decision": "allow" 또는 "review" 또는 "block",
  "reason": "짧은 한국어 설명"
}

판정 기준:
- 안전한 일반 대화는 allow
- 문맥이 애매하거나 공격적으로 보일 수 있으면 review
- 명백한 욕설, 모욕, 비방, 괴롭힘 또는 협박이면 block

게시물:
${JSON.stringify(memo.trim())}
      `,
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text);

    return {
      decision: result.decision,
      reason: result.reason,
    };
  } catch (error) {
  console.error("Gemini moderation error:");
  console.error(error);

  throw new HttpsError(
    "internal",
    error?.message || "Gemini 검사 중 오류가 발생했습니다."
  );
}
});