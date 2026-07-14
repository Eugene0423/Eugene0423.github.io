import {
  db,
  doc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  limit,
  deleteDoc,
} from "./firebase.js";

let securityLogs = [];

const filterState = {
  sortBy: "date",
  limit: 10, // 한 페이지에 표시할 카드 수
  order: "ascending",
};

// Pagination 상태
let currentPage = 1;
let totalPages = 1;

// Pagination HTML 요소
const prevPageButton = document.getElementById("prevPageButton");
const nextPageButton = document.getElementById("nextPageButton");
const pageInfo = document.getElementById("pageInfo");

// Filter panel
const filterPanel = document.querySelector(".filter-panel");
const filterButton = document.getElementById("filterButton");

if (filterPanel && filterButton) {
  filterButton.addEventListener("click", function (event) {
    event.stopPropagation();
    filterPanel.classList.toggle("open");
  });
}

// Session ID 가져오기
function getSessionId() {
  let sessionID = localStorage.getItem("profile_session_id");

  if (!sessionID) {
    sessionID = crypto.randomUUID();
    localStorage.setItem("profile_session_id", sessionID);
  }

  return sessionID;
}

// Filter 선택 버튼
const filterChoices = document.querySelectorAll(".filter-choice");

if (filterChoices.length > 0) {
  filterChoices.forEach(function (choice) {
    choice.addEventListener("click", function (event) {
      event.stopPropagation();

      const group = choice.dataset.group;
      const value = choice.dataset.value;

      if (group === "limit") {
        filterState[group] = Number(value);
      } else {
        filterState[group] = value;
      }

      // 같은 그룹의 active 제거
      document
        .querySelectorAll(`.filter-choice[data-group="${group}"]`)
        .forEach(function (button) {
          button.classList.remove("active");
        });

      // 선택한 버튼에만 active 추가
      choice.classList.add("active");

      // 필터가 바뀌면 첫 페이지로 이동
      currentPage = 1;

      applySecurityFilter();
    });
  });
}

// Previous 버튼
if (prevPageButton) {
  prevPageButton.addEventListener("click", function (event) {
    event.stopPropagation();

    // 첫 페이지이면 아무것도 하지 않음
    if (currentPage <= 1) return;

    currentPage--;
    applySecurityFilter();
  });
}

// Next 버튼
if (nextPageButton) {
  nextPageButton.addEventListener("click", function (event) {
    event.stopPropagation();

    // 마지막 페이지이면 아무것도 하지 않음
    if (currentPage >= totalPages) return;

    currentPage++;
    applySecurityFilter();
  });
}

// 로그의 날짜를 숫자로 변환
function getLogTime(log) {
  if (log.createdAt && log.createdAt.toDate) {
    return log.createdAt.toDate().getTime();
  }

  if (log.timestamp && log.timestamp.toDate) {
    return log.timestamp.toDate().getTime();
  }

  if (log.updatedAt && log.updatedAt.toDate) {
    return log.updatedAt.toDate().getTime();
  }

  return 0;
}

// Severity를 정렬 가능한 숫자로 변환
function getSeverityScore(severity) {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;

  return 0;
}

// Filter + Sort + Pagination 적용
function applySecurityFilter() {
  const result = [...securityLogs];

  // 정렬
  result.sort(function (a, b) {
    let compare = 0;

    if (filterState.sortBy === "date") {
      compare = getLogTime(a) - getLogTime(b);
    }

    if (filterState.sortBy === "severity") {
      compare =
        getSeverityScore(a.severity) -
        getSeverityScore(b.severity);
    }

    if (filterState.sortBy === "alphabet") {
      compare = (a.type || "").localeCompare(b.type || "");
    }

    if (filterState.order === "descending") {
      compare *= -1;
    }

    return compare;
  });

  const cardsPerPage = filterState.limit;

  // 전체 페이지 수 계산
  totalPages = Math.max(
    1,
    Math.ceil(result.length / cardsPerPage)
  );

  // 카드 삭제 등으로 페이지 수가 줄어든 경우 조정
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  if (currentPage < 1) {
    currentPage = 1;
  }

  // 현재 페이지에서 보여줄 범위
  const startIndex = (currentPage - 1) * cardsPerPage;
  const endIndex = startIndex + cardsPerPage;

  const currentPageLogs = result.slice(startIndex, endIndex);

  renderSecurityLogs(currentPageLogs);
  updatePagination(result.length);
}

// Pagination 글자와 버튼 상태 업데이트
function updatePagination(totalLogs) {
  if (pageInfo) {
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  }

  if (prevPageButton) {
    prevPageButton.disabled =
      totalLogs === 0 || currentPage <= 1;
  }

  if (nextPageButton) {
    nextPageButton.disabled =
      totalLogs === 0 || currentPage >= totalPages;
  }
}

// Admin 관련 필드 검사
export async function hasBlockedAdminField(data) {
  const BLOCKED_ADMIN_FIELDS = ["role", "isAdmin", "admin"];
  const keys = Object.keys(data);

  const blockedField = keys.find(function (key) {
    return BLOCKED_ADMIN_FIELDS.includes(key);
  });

  if (blockedField) {
    await logSecurityEvent(
      "ADMIN_FIELD_BLOCK",
      "high",
      "Blocked write attempt containing admin-related field.",
      {
        blockedField: blockedField,
        attemptedKeys: keys,
      }
    );

    return true;
  }

  return false;
}

// Security event 저장
export async function logSecurityEvent(
  type,
  severity,
  message,
  detail = {}
) {
  try {
    const sessionID = getSessionId();

    await addDoc(collection(db, "securityLogs"), {
      type,
      severity,
      message,
      sessionID,
      detail,
      createdAt: serverTimestamp(),
      path: window.location.pathname,
      userAgent: navigator.userAgent,
    });
  } catch (error) {
    console.error("Error logging security event:", error);
  }
}

// Firestore securityLogs 실시간 불러오기
export function showSecurityEvents() {
  const securityEvents = document.getElementById("securityEvents");

  if (!securityEvents) {
    console.warn("Security events element not found.");
    return;
  }

  const securityQuery = query(
    collection(db, "securityLogs"),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  onSnapshot(
    securityQuery,

    function (snapshot) {
      securityLogs = [];

      snapshot.forEach(function (firebaseDoc) {
        securityLogs.push({
          id: firebaseDoc.id,
          ...firebaseDoc.data(),
        });
      });

      // Firestore 데이터를 받은 뒤 필터와 pagination 적용
      applySecurityFilter();
    },

    function (error) {
      console.error("Security events listener failed:", error);
    }
  );
}

// Security card 화면에 출력
function renderSecurityLogs(logs) {
  const securityEvents = document.getElementById("securityEvents");

  if (!securityEvents) return;

  securityEvents.innerHTML = "";

  if (logs.length === 0) {
    const emptyMessage = document.createElement("p");

    emptyMessage.className = "empty-security-message";
    emptyMessage.textContent = "No security events logged.";

    securityEvents.appendChild(emptyMessage);
    return;
  }

  logs.forEach(function (data) {
    const logId = data.id;

    const card = document.createElement("div");
    card.className =
      `security-card ${data.severity || "low"}`;

    const header = document.createElement("div");
    header.className = "security-card-header";

    const type = document.createElement("span");
    type.className = "security-type";
    type.textContent = data.type || "Unknown Event";

    const severity = document.createElement("span");
    severity.className = "security-severity";
    severity.textContent = data.severity || "low";

    header.appendChild(type);
    header.appendChild(severity);

    const message = document.createElement("p");
    message.className = "security-message";
    message.textContent =
      data.message || "No message available.";

    const session = document.createElement("small");
    session.className = "security-meta";

    const savedSessionId = data.sessionID || "unknown";

    session.textContent =
      `Session: ${savedSessionId.slice(0, 8)}...`;

    const date = document.createElement("small");
    date.className = "security-meta";

    if (data.createdAt && data.createdAt.toDate) {
      date.textContent =
        data.createdAt.toDate().toLocaleString();
    } else {
      date.textContent = "Logging...";
    }

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    const buttonBox = document.createElement("div");
    buttonBox.classList.add("button-box");

    deleteButton.addEventListener(
      "click",
      async function () {
        const confirmDelete = confirm("Delete this log?");

        if (!confirmDelete) return;

        try {
          await deleteDoc(
            doc(db, "securityLogs", logId)
          );

          /*
            삭제 후 onSnapshot이 자동으로 다시 실행되므로
            여기에서 renderSecurityLogs를 다시 호출할 필요 없음
          */
        } catch (error) {
          console.error("Delete failed:", error);
          alert(error.message);

          try {
            await logSecurityEvent(
              "Delete log failed",
              "medium",
              "Failed to delete a security log entry.",
              {
                logId: logId,
                errorCode: error.code,
                errorMessage: error.message,
              }
            );
          } catch (logError) {
            console.error(
              "Failed to write security event:",
              logError
            );
          }
        }
      }
    );

    card.appendChild(header);
    card.appendChild(message);
    card.appendChild(session);
    card.appendChild(date);

    buttonBox.appendChild(deleteButton);
    card.appendChild(buttonBox);

    securityEvents.appendChild(card);
  });
}