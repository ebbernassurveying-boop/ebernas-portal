import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

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
export const db = getFirestore(app);
export const auth = getAuth(app);

// ── FIRESTORE HELPERS ──────────────────────────────────────────────────────────

// SCHEDULES
export async function getSchedules() {
  const snap = await getDocs(collection(db, "schedules"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveSchedule(schedule) {
  const ref = schedule.id ? doc(db, "schedules", schedule.id) : doc(collection(db, "schedules"));
  await setDoc(ref, { ...schedule, id: ref.id });
  return ref.id;
}

export async function deleteScheduleDB(id) {
  await deleteDoc(doc(db, "schedules", id));
}

export function listenSchedules(callback) {
  return onSnapshot(collection(db, "schedules"), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// EMPLOYEES
export async function getEmployeesDB() {
  const snap = await getDocs(collection(db, "employees"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveEmployeeDB(employee) {
  const ref = doc(db, "employees", employee.email);
  await setDoc(ref, employee);
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

// CASES
export async function getCases() {
  const snap = await getDocs(collection(db, "cases"));
  const result = {};
  snap.docs.forEach(d => { result[d.id] = d.data(); });
  return result;
}

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
