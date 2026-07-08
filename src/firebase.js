import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, doc, setDoc, getDocs, getDoc, updateDoc, deleteDoc, onSnapshot,
} from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject, listAll } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAm7_PuCdbArYjd0WpK-2G-XWiPmP8kD2w",
  authDomain: "ebernas-portal.firebaseapp.com",
  projectId: "ebernas-portal",
  storageBucket: "ebernas-portal.firebasestorage.app",
  messagingSenderId: "302000361688",
  appId: "1:302000361688:web:ea438f94e1cb7e1bdb47ad",
  measurementId: "G-GHHYB4T2FJ"
};

const app = initializeApp(firebaseConfig);

// ── OFFLINE PERSISTENCE ──────────────────────────────────────────────────────
// Gumagana ang app kahit walang internet. Naka-cache sa device (IndexedDB) ang
// data; awtomatikong nag-sa-sync pagbalik ng koneksyon. Multi-tab ready.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const storage = getStorage(app);
export { getDocs, collection };

// SCHEDULES
export async function saveSchedule(schedule) {
  const ref = schedule.id ? doc(db, "schedules", String(schedule.id)) : doc(collection(db, "schedules"));
  await setDoc(ref, { ...schedule, id: ref.id });
  return ref.id;
}
export async function deleteScheduleDB(id) {
  await deleteDoc(doc(db, "schedules", String(id)));
}
export function listenSchedules(callback) {
  return onSnapshot(collection(db, "schedules"), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// EMPLOYEES
export async function saveEmployeeDB(employee) {
  const docKey = (employee.email?.trim()) || employee.employeeId || `EMP-${Date.now()}`;
  await setDoc(doc(db, "employees", docKey), { ...employee, docKey });
}
export async function updateEmployeeDB(email, data) {
  await updateDoc(doc(db, "employees", email), data);
}
export async function deleteEmployeeDB(email) {
  await deleteDoc(doc(db, "employees", email));
}
export function listenEmployees(callback) {
  return onSnapshot(collection(db, "employees"), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// PROFILES — persistent profile data for all users including hardcoded admins
export async function saveProfile(email, data) {
  const key = email.replace(/[^a-zA-Z0-9]/g, "_");
  await setDoc(doc(db, "profiles", key), { email, ...data }, { merge: true });
}
export async function getProfile(email) {
  const key = email.replace(/[^a-zA-Z0-9]/g, "_");
  const snap = await getDoc(doc(db, "profiles", key));
  return snap.exists() ? snap.data() : null;
}
// CASES
export async function saveCase(clientName, caseData) {
  await setDoc(doc(db, "cases", clientName), caseData);
}
export function listenCases(callback) {
  return onSnapshot(collection(db, "cases"), snap => {
    const result = {};
    snap.docs.forEach(d => { result[d.id] = d.data(); });
    callback(result);
  });
}

// STORAGE — File uploads per client
// Upload a file, returns { name, url, type, size, uploadedAt }
export async function uploadClientFile(clientName, file, onProgress) {
  const safeName = clientName.replace(/[^a-zA-Z0-9]/g, "_");
  const timestamp = Date.now();
  const storageRef = ref(storage, `clients/${safeName}/${timestamp}_${file.name}`);
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on("state_changed",
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        if (onProgress) onProgress(pct);
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({
          name: file.name,
          url,
          type: file.type,
          size: file.size,
          path: task.snapshot.ref.fullPath,
          uploadedAt: new Date().toLocaleDateString("en-PH"),
        });
      }
    );
  });
}

// Delete a file from storage
export async function deleteClientFile(filePath) {
  const storageRef = ref(storage, filePath);
  await deleteObject(storageRef);
}

// List all files for a client
export async function listClientFiles(clientName) {
  const safeName = clientName.replace(/[^a-zA-Z0-9]/g, "_");
  const folderRef = ref(storage, `clients/${safeName}`);
  try {
    const result = await listAll(folderRef);
    const files = await Promise.all(result.items.map(async item => ({
      name: item.name.replace(/^\d+_/, ""), // remove timestamp prefix
      url: await getDownloadURL(item),
      path: item.fullPath,
    })));
    return files;
  } catch {
    return [];
  }
}

// Delete a case from Firestore
export async function deleteCase(clientName) {
  await deleteDoc(doc(db, "cases", clientName));
}
