import { getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  getFirestore,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const app = firebaseConfigured
  ? getApps()[0] || initializeApp(firebaseConfig)
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export function getSessionRef(sessionId) {
  return doc(db, "sessions", sessionId);
}

export function getTeamsCollection(sessionId) {
  return collection(db, "sessions", sessionId, "teams");
}

export function getTeamRef(sessionId, teamId) {
  return doc(db, "sessions", sessionId, "teams", teamId);
}

export function getPublicAnswersCollection(sessionId) {
  return collection(db, "sessions", sessionId, "publicAnswers");
}

export async function signInApp() {
  if (!auth) throw new Error("尚未設定 Firebase，請先完成 .env。");
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export function listenToSession(sessionId, callback, onError) {
  return onSnapshot(getSessionRef(sessionId), (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, onError);
}

export function listenToTeam(sessionId, teamId, callback, onError) {
  return onSnapshot(getTeamRef(sessionId, teamId), (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, onError);
}

export function listenToTeams(sessionId, callback, onError) {
  return onSnapshot(query(getTeamsCollection(sessionId), orderBy("createdAt", "asc")), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}

export function listenToPublicAnswers(sessionId, callback, onError) {
  return onSnapshot(getPublicAnswersCollection(sessionId), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}

export async function claimTeacherSession(sessionId, user) {
  const sessionRef = getSessionRef(sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) {
    await setDoc(sessionRef, {
      status: "waiting",
      started: false,
      currentView: "waiting",
      currentQuestion: 1,
      published: false,
      explanationVisible: false,
      teamCount: 0,
      completedCount: 0,
      teacherUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }
  const existingSession = sessionSnap.data();
  if (existingSession.started === undefined && existingSession.status === "answering") {
    await updateDoc(sessionRef, { status: "waiting", started: false, currentView: "waiting", published: false, explanationVisible: false, updatedAt: serverTimestamp() });
  } else if (existingSession.currentView === undefined) {
    await updateDoc(sessionRef, { currentView: existingSession.started ? "question" : "waiting", updatedAt: serverTimestamp() });
  }
  if (!sessionSnap.data().teacherUid) {
    await updateDoc(sessionRef, { teacherUid: user.uid, updatedAt: serverTimestamp() });
  }
}

export async function createTeam(sessionId, teamId, team) {
  const sessionRef = getSessionRef(sessionId);
  const teamRef = getTeamRef(sessionId, teamId);
  await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("老師尚未啟動本場。");
    if (sessionSnap.data().status === "stopped") throw new Error("老師已停止加入，請先確認課堂狀態。");
    transaction.set(teamRef, {
      ...team,
      ownerUid: auth.currentUser.uid,
      answers: {},
      submitted: {},
      createdAt: serverTimestamp(),
    });
    transaction.update(sessionRef, {
      teamCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function submitAnswer(sessionId, teamId, questionId, answer) {
  const sessionRef = getSessionRef(sessionId);
  const teamRef = getTeamRef(sessionId, teamId);
  const publicAnswerRef = doc(getPublicAnswersCollection(sessionId), `${teamId}_${questionId}`);
  await runTransaction(db, async (transaction) => {
    const [sessionSnap, teamSnap] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(teamRef),
    ]);
    if (!sessionSnap.exists() || !teamSnap.exists()) throw new Error("找不到本場或隊伍，請重新加入。");
    const session = sessionSnap.data();
    const team = teamSnap.data();
    if (session.status !== "answering") throw new Error("目前已停止作答。");
    if (team.submitted?.[questionId]) throw new Error("這一題已經提交，不能修改。");
    transaction.update(teamRef, {
      [`answers.${questionId}`]: { value: answer, submittedAt: serverTimestamp() },
      [`submitted.${questionId}`]: true,
      updatedAt: serverTimestamp(),
    });
    transaction.set(publicAnswerRef, {
      teamId,
      teamName: team.teamName,
      ownerUid: auth.currentUser.uid,
      questionId,
      value: answer,
      submittedAt: serverTimestamp(),
    });
    transaction.update(sessionRef, {
      completedCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function setSessionStatus(sessionId, status) {
  await updateDoc(getSessionRef(sessionId), {
    status,
    ...(status === "answering" ? { started: true, currentView: "question" } : {}),
    ...(status === "waiting" ? { started: false, currentView: "waiting" } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function setSessionView(sessionId, changes) {
  await updateDoc(getSessionRef(sessionId), { ...changes, updatedAt: serverTimestamp() });
}

export async function advanceQuestion(sessionId, questionNumber) {
  await updateDoc(getSessionRef(sessionId), {
    currentQuestion: questionNumber,
    status: "answering",
    started: true,
    currentView: "question",
    published: false,
    explanationVisible: false,
    completedCount: 0,
    updatedAt: serverTimestamp(),
  });
}

export async function resetSession(sessionId) {
  const sessionRef = getSessionRef(sessionId);
  const teamsSnap = await getDoc(sessionRef);
  if (!teamsSnap.exists()) return;
  const teamQuery = query(getTeamsCollection(sessionId));
  const teams = await getDocs(teamQuery);
  const publicAnswerQuery = query(getPublicAnswersCollection(sessionId));
  const publicAnswers = await getDocs(publicAnswerQuery);
  const batch = writeBatch(db);
  teams.docs.forEach((team) => batch.delete(team.ref));
  publicAnswers.docs.forEach((answer) => batch.delete(answer.ref));
  batch.update(sessionRef, {
    status: "waiting",
    started: false,
    currentView: "waiting",
    currentQuestion: 1,
    published: false,
    explanationVisible: false,
    teamCount: 0,
    completedCount: 0,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
