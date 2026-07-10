// zk-receiver.js — ZKTeco Attendance Receiver (para sa VPS)
// Tumatanggap ng attendance mula sa ZKTeco WL 20 (iclock/ADMS protocol)
// tapos sino-store sa Firebase Firestore (para makita sa EB Bernas Portal).
//
// PAANO PATAKBUHIN (sa VPS):
//   1. Ilagay ang file na ito sa isang folder (hal. C:\zk-receiver\zk-receiver.js)
//   2. Buksan ang Command Prompt sa folder na yun
//   3. npm init -y
//   4. npm install firebase
//   5. node zk-receiver.js
//
// Ang device config (mamaya):
//   Server Address: 185.167.119.115
//   Server Port: 8080
//   Domain Name: Off

const http = require("http");
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc } = require("firebase/firestore");

const PORT = 8080;

// Firebase config (kapareho ng portal mo)
const firebaseConfig = {
  apiKey: "AIzaSyAm7_PuCdbArYjd0WpK-2G-XWiPmP8kD2w",
  authDomain: "ebernas-portal.firebaseapp.com",
  projectId: "ebernas-portal",
  storageBucket: "ebernas-portal.firebasestorage.app",
  messagingSenderId: "302000361688",
  appId: "1:302000361688:web:ea438f94e1cb7e1bdb47ad",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper: basahin ang raw body ng request
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}

// Helper: kunin ang query params
function getQuery(url) {
  const q = {};
  const idx = url.indexOf("?");
  if (idx === -1) return q;
  url.slice(idx + 1).split("&").forEach((pair) => {
    const [k, v] = pair.split("=");
    if (k) q[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return q;
}

const server = http.createServer(async (req, res) => {
  const now = new Date().toLocaleString("en-PH");
  const q = getQuery(req.url);
  const SN = q.SN || q.sn || "";
  const table = q.table || "";

  res.setHeader("Content-Type", "text/plain");

  // Handshake / config request (GET /iclock/cdata)
  if (req.method === "GET" && req.url.includes("/iclock/cdata")) {
    console.log(`[${now}] 📡 Handshake mula sa device SN=${SN}`);
    res.writeHead(200);
    res.end(
      `GET OPTION FROM: ${SN}\n` +
      `Stamp=9999\nOpStamp=9999\nErrorDelay=30\nDelay=10\n` +
      `TransTimes=00:00;14:05\nTransInterval=1\nTransFlag=1111000000\n` +
      `Realtime=1\nEncrypt=0\n`
    );
    return;
  }

  // Command polling (GET /iclock/getrequest)
  if (req.method === "GET" && req.url.includes("/iclock/getrequest")) {
    res.writeHead(200);
    res.end("OK");
    return;
  }

  // Attendance data upload (POST /iclock/cdata?table=ATTLOG)
  if (req.method === "POST" && req.url.includes("/iclock/cdata")) {
    const body = await readBody(req);
    if (table === "ATTLOG") {
      const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
      console.log(`[${now}] ✅ Attendance mula SN=${SN}: ${lines.length} record(s)`);
      for (const line of lines) {
        const p = line.split("\t");
        const record = {
          userId: p[0] || "",
          timestamp: p[1] || "",
          status: p[2] || "",
          verify: p[3] || "",
          workcode: p[4] || "",
          sn: SN,
          raw: line,
          receivedAt: new Date().toISOString(),
        };
        console.log(`   👤 User ${record.userId} @ ${record.timestamp}`);
        try {
          await addDoc(collection(db, "attendance"), record);
        } catch (e) {
          console.error("   ❌ Firebase error:", e.message);
        }
      }
      res.writeHead(200);
      res.end(`OK: ${lines.length}`);
      return;
    }
    // Ibang table (OPERLOG, etc.)
    res.writeHead(200);
    res.end("OK: 0");
    return;
  }

  // Default
  res.writeHead(200);
  res.end("OK");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log("  ZKTeco Attendance Receiver — RUNNING");
  console.log(`  Port: ${PORT}`);
  console.log(`  Listening: 0.0.0.0:${PORT}`);
  console.log("  Naghihintay ng data mula sa device...");
  console.log("========================================");
});
