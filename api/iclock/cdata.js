// api/iclock/cdata.js — ZKTeco Push (ADMS) protocol handler
// Tinatanggap ang attendance mula sa ZKTeco device (WL 20) at sino-store sa Firestore.
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAm7_PuCdbArYjd0WpK-2G-XWiPmP8kD2w",
  authDomain: "ebernas-portal.firebaseapp.com",
  projectId: "ebernas-portal",
  storageBucket: "ebernas-portal.firebasestorage.app",
  messagingSenderId: "302000361688",
  appId: "1:302000361688:web:ea438f94e1cb7e1bdb47ad",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

// Kailangan ng raw body (hindi JSON) — text/tab-separated ang ZKTeco
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  const SN = req.query.SN || req.query.sn || "";
  const table = req.query.table || "";

  res.setHeader("Content-Type", "text/plain");

  // 1) HANDSHAKE — device registration/config request (GET)
  if (req.method === "GET") {
    return res.status(200).send(
      `GET OPTION FROM: ${SN}\n` +
      `Stamp=9999\n` +
      `OpStamp=9999\n` +
      `ErrorDelay=30\n` +
      `Delay=10\n` +
      `TransTimes=00:00;14:05\n` +
      `TransInterval=1\n` +
      `TransFlag=1111000000\n` +
      `Realtime=1\n` +
      `Encrypt=0\n`
    );
  }

  // 2) DATA UPLOAD (POST)
  if (req.method === "POST") {
    let body = "";
    try { body = await readRawBody(req); } catch (e) { console.error("body read error", e); }

    // Attendance log
    if (table === "ATTLOG") {
      const lines = body.split("\n").map(l => l.trim()).filter(Boolean);
      const records = lines.map(line => {
        const parts = line.split("\t");
        return {
          userId: parts[0] || "",
          timestamp: parts[1] || "",
          status: parts[2] || "",   // 0=check-in, 1=check-out, etc.
          verify: parts[3] || "",   // 1=fingerprint, 15=face, etc.
          workcode: parts[4] || "",
          sn: SN,
          raw: line,
          receivedAt: new Date().toISOString(),
        };
      });
      try {
        await Promise.all(records.map(r => addDoc(collection(db, "attendance"), r)));
      } catch (e) { console.error("firestore write error", e); }
      return res.status(200).send(`OK: ${records.length}`);
    }

    // Other tables (OPERLOG, USERINFO, etc.) — acknowledge lang muna
    return res.status(200).send("OK: 0");
  }

  return res.status(200).send("OK");
}
