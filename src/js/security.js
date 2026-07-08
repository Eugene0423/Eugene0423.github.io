import {
  db,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "./firebase.js";

function getSessionId() {
  let sessionID = localStorage.getItem("profile_session_id");

  if (!sessionID) {
    sessionID = crypto.randomUUID();
    localStorage.setItem("profile_session_id", sessionID);
  }

  return sessionID;
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

        card.appendChild(header);
        card.appendChild(message);
        card.appendChild(session);
        card.appendChild(date);

        securityEvents.appendChild(card);
      });
    },
    function (error) {
      console.error("Security events listener failed:", error);
    }
  );
}