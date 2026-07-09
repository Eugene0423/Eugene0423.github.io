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

  console.log("Check if it works");

function getSessionId() {
  let sessionID = localStorage.getItem("profile_session_id");

  if (!sessionID) {
    sessionID = crypto.randomUUID();
    localStorage.setItem("profile_session_id", sessionID);
  }

  return sessionID;
}

// 이거 정리 필요: 객체의 필드 이름 검사해서 admin 관련 필드가 있으면 true 반환, 없으면 false 반환
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

export async function logSecurityEvent(type, severity, message, detail = {}) {
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

export function showSecurityEvents() {
  const securityEvents = document.getElementById("securityEvents");

  if (!securityEvents) {
    console.warn("Security events element not found.");
    return;
  }

  const securityQuery = query(
    collection(db, "securityLogs"),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  onSnapshot(
    securityQuery,
    function (snapshot) {
      securityEvents.innerHTML = "";

      if (snapshot.empty) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "empty-security-message";
        emptyMessage.textContent = "No security events logged.";
        securityEvents.appendChild(emptyMessage);
        return;
      }

      snapshot.forEach(function (firebaseDoc) {
        const logId = firebaseDoc.id;
        const data = firebaseDoc.data();

        const card = document.createElement("div");
        card.className = `security-card ${data.severity || "low"}`;

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
        message.textContent = data.message || "No message available.";

        const session = document.createElement("small");
        session.className = "security-meta";

        const savedSessionId = data.sessionID || "unknown";
        session.textContent = `Session: ${savedSessionId.slice(0, 8)}...`;

        const date = document.createElement("small");
        date.className = "security-meta";

        if (data.createdAt) {
          date.textContent = data.createdAt.toDate().toLocaleString();
        } else {
          date.textContent = "Logging...";
        }

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";

        const buttonBox = document.createElement("div");
        buttonBox.classList.add("button-box");

        deleteButton.addEventListener("click", async function () {
          const confirmDelete = confirm("Delete this log?");
          if (!confirmDelete) return;

          try {
            await deleteDoc(doc(db, "securityLogs", logId));
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
              console.error("Failed to write security event:", logError);
            }
          }
        });

        card.appendChild(header);
        card.appendChild(message);
        card.appendChild(session);
        card.appendChild(date);

        buttonBox.appendChild(deleteButton);
        card.appendChild(buttonBox);

        securityEvents.appendChild(card);
      });
    },
    function (error) {
      console.error("Security events listener failed:", error);
    }
  );
}