import {
  db,
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "./firebase.js";

import { logSecurityEvent } from "./security.js";

//for the visitor graph
const visitorCanvas = document.getElementById("visitorChart");

function getTodayId() {
  return new Date().toISOString().split("T")[0];
}

// 방문자 함수 근처에 sessionID 관련 내용물 추가
// 넣는 이유: 같은 sessionID가 너무 빨리 count을 올리면 차단, securityLogs에 기록
function getSessionId() {
  let sessionID = localStorage.getItem("profile_session_id");

  if (!sessionID) {
    sessionID = crypto.randomUUID();
    localStorage.setItem("profile_session_id", sessionID);
  }

  return sessionID;
}

async function countTodayVisit() {
  const sessionID = getSessionId();

  console.log("Current session:", sessionID);

  const today = getTodayId();
  const now = Date.now();

  const visitRef = doc(db, "visits", today);
  const sessionRef = doc(db, "visitorSessions", sessionID);

  const visitSnap = await getDoc(visitRef);

  const VISIT_COOLDOWN = 1000 * 60; // 1 minute
  const sessionSnap = await getDoc(sessionRef);

  if (sessionSnap.exists()) {
    const sessionData = sessionSnap.data();
    const lastVisitAtMs = sessionData.lastVisitAtMs || 0;
    const diffMs = now - lastVisitAtMs;

    if (diffMs<VISIT_COOLDOWN){
      console.warn("Repeated visit blocked:", diffMs);

      await logSecurityEvent(
        "VISIT_RATE_LIMIT",
        "medium",
        "Repeated visit blocked",
        {
          diffMs: diffMs,
          cooldownMs: VISIT_COOLDOWN,
        }
      );

      return;
    }

    await setDoc(sessionRef, {
      sessionID: sessionID,
      lastVisitAtMs: now,
      lastVisitAt: serverTimestamp(),
      visitCount: (sessionData.visitCount || 0) + 1,
    });
  } else {
    await setDoc(sessionRef, {
      sessionID: sessionID,
      lastVisitAtMs: now,
      lastVisitAt: serverTimestamp(),
      visitCount: 1,
    });
  }

  if (visitSnap.exists()) {
    const currentCount = visitSnap.data().count || 0;

    await setDoc(visitRef, {
      date: today,
      count: currentCount + 1,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(visitRef, {
      date: today,
      count: 1,
      updatedAt: serverTimestamp(),
    });
  }
}

async function getVisitData() {
  const visitsQuery = query(
    collection(db, "visits"),
    orderBy("date", "desc"),
    limit(7)
  );

  const snapshot = await getDocs(visitsQuery);

  const visits = snapshot.docs.map((doc) => doc.data());

  // Firestore에서 desc로 가져왔으니까 그래프용으로 다시 오래된 날짜 → 최신 날짜 순서로 변경
  // 잠시만, 근데 지금 이걸 하면 최신 날짜가 제일 아래로 가는 거 아냐? -> 이거 고칠 필요 있음
  return visits.reverse();
}

function drawVisitorChart(visits) {
  if (!visitorCanvas || typeof Chart === "undefined") return;

  const labels = visits.map((item) => item.date);
  const counts = visits.map((item) => item.count);

  new Chart(visitorCanvas, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Visitors",
          data: counts,
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

export async function initVisitorGraph() {
  try {
    await countTodayVisit();

    const visits = await getVisitData();

    drawVisitorChart(visits);
  } catch (error) {
    console.error("Visitor graph error:", error);
  }
}