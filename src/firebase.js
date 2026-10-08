import { getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithEmailAndPassword } from "firebase/auth";
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
import { QUESTIONS } from "./questions.js";
import { buildLeaderboard, finalizeScoreSnapshot } from "./scoring.js";

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

// 教師使用獨立的 Firebase App，避免教師登入切換同一瀏覽器中的學生匿名身分。
const teacherApp = firebaseConfigured
  ? getApps().find((candidate) => candidate.name === "teacher") || initializeApp(firebaseConfig, "teacher")
  : null;
export const teacherAuth = teacherApp ? getAuth(teacherApp) : null;
export const teacherDb = teacherApp ? getFirestore(teacherApp) : null;
const TEACHER_EMAIL = import.meta.env.VITE_TEACHER_EMAIL || "teacher@newton-research-challenge.web.app";
const TEACHER_PASSWORD = import.meta.env.VITE_TEACHER_PASSWORD || "0519";
const TEACHER_AUTH_PASSWORD = import.meta.env.VITE_TEACHER_AUTH_PASSWORD || "0519newton";

export function getSessionRef(sessionId, database = db) {
  return doc(database, "sessions", sessionId);
}

export function getTeamsCollection(sessionId, database = db) {
  return collection(database, "sessions", sessionId, "teams");
}

export function getTeamRef(sessionId, teamId, database = db) {
  return doc(database, "sessions", sessionId, "teams", teamId);
}

export function getPublicAnswersCollection(sessionId, database = db) {
  return collection(database, "sessions", sessionId, "publicAnswers");
}

export function getLeaderboardCollection(sessionId, database = db) {
  return collection(database, "sessions", sessionId, "leaderboard");
}

export function getLeaderboardRef(sessionId, teamId, database = db) {
  return doc(database, "sessions", sessionId, "leaderboard", teamId);
}

export async function signInApp() {
  if (!auth) throw new Error("尚未設定 Firebase，請先完成 .env。");
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function signInTeacher(password) {
  if (!teacherAuth) throw new Error("尚未設定 Firebase，請先完成 .env。");
  if (password !== TEACHER_PASSWORD) throw new Error("教師密碼不正確。");
  if (teacherAuth.currentUser) return teacherAuth.currentUser;
  const credential = await signInWithEmailAndPassword(teacherAuth, TEACHER_EMAIL, TEACHER_AUTH_PASSWORD);
  return credential.user;
}

export function listenToSession(sessionId, callback, onError, database = db) {
  return onSnapshot(getSessionRef(sessionId, database), (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, onError);
}

export function listenToTeam(sessionId, teamId, callback, onError) {
  return onSnapshot(getTeamRef(sessionId, teamId), (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, onError);
}

export function listenToTeams(sessionId, callback, onError, database = db) {
  return onSnapshot(query(getTeamsCollection(sessionId, database), orderBy("createdAt", "asc")), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}

export function listenToPublicAnswers(sessionId, callback, onError) {
  return onSnapshot(getPublicAnswersCollection(sessionId), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}

export function listenToLeaderboard(sessionId, callback, onError) {
  return onSnapshot(getLeaderboardCollection(sessionId), (snapshot) => {
    callback(buildLeaderboard(snapshot.docs.map((item) => ({ teamId: item.id, ...item.data() }))));
  }, onError);
}

export async function claimTeacherSession(sessionId, user) {
  const sessionRef = getSessionRef(sessionId, teacherDb);
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
      scoringFinalized: {},
      leaderboardVisible: false,
      teacherUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }
  const existingSession = sessionSnap.data();
  const migration = {};
  if (existingSession.started === undefined && existingSession.status === "answering") {
    Object.assign(migration, { status: "waiting", started: false, currentView: "waiting", published: false, explanationVisible: false });
  } else if (existingSession.currentView === undefined) {
    migration.currentView = existingSession.started ? "question" : "waiting";
  }
  if (existingSession.scoringFinalized === undefined) migration.scoringFinalized = {};
  if (existingSession.leaderboardVisible === undefined) migration.leaderboardVisible = false;
  if (existingSession.teacherUid !== user.uid) migration.teacherUid = user.uid;
  if (Object.keys(migration).length > 0) {
    await updateDoc(sessionRef, { ...migration, updatedAt: serverTimestamp() });
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
      score: 0,
      scoring: {},
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

export async function finalizeScoring(sessionId, questionId, database = db) {
  const question = QUESTIONS.find((item) => item.id === questionId);
  if (!question) throw new Error("找不到要計分的題目。");
  const sessionRef = getSessionRef(sessionId, database);
  const teamQuery = query(getTeamsCollection(sessionId, database));
  const [sessionSnap, teamsSnap] = await Promise.all([getDoc(sessionRef), getDocs(teamQuery)]);
  if (!sessionSnap.exists()) throw new Error("找不到本場。");
  const session = sessionSnap.data();
  const teams = teamsSnap.docs.map((item) => ({ ...item.data(), id: item.id }));
  const result = finalizeScoreSnapshot({ session, teams, question });
  if (result.alreadyFinalized) return result;

  const teamRefs = new Map(teamsSnap.docs.map((item) => [item.id, item.ref]));
  const batch = writeBatch(database);
  result.teamUpdates.forEach((update) => {
    const teamRef = teamRefs.get(update.teamId);
    if (!teamRef) throw new Error("有隊伍資料缺少有效的隊伍 ID，請重新整理教師端後再試。");
    batch.update(teamRef, {
      score: update.score,
      [`scoring.${questionId}`]: update.scoring,
      updatedAt: serverTimestamp(),
    });
  });
  result.leaderboard.forEach((row) => {
    if (typeof row.teamId !== "string" || !row.teamId) throw new Error("有隊伍資料缺少有效的排行榜 ID，請重新整理教師端後再試。");
    batch.set(getLeaderboardRef(sessionId, row.teamId, database), {
      teamName: row.teamName,
      score: row.score,
      updatedAt: serverTimestamp(),
    });
  });
  batch.update(sessionRef, {
    [`scoringFinalized.${questionId}`]: true,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return result;
}

export async function setSessionStatus(sessionId, status, database = db) {
  await updateDoc(getSessionRef(sessionId, database), {
    status,
    ...(status === "answering" ? { started: true, currentView: "question" } : {}),
    ...(status === "waiting" ? { started: false, currentView: "waiting" } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function setSessionView(sessionId, changes, database = db) {
  await updateDoc(getSessionRef(sessionId, database), { ...changes, updatedAt: serverTimestamp() });
}

export async function advanceQuestion(sessionId, questionNumber, database = db) {
  await updateDoc(getSessionRef(sessionId, database), {
    currentQuestion: questionNumber,
    status: "answering",
    started: true,
    currentView: "question",
    published: false,
    explanationVisible: false,
    leaderboardVisible: false,
    completedCount: 0,
    updatedAt: serverTimestamp(),
  });
}

export async function resetSession(sessionId, database = db) {
  const sessionRef = getSessionRef(sessionId, database);
  const teamsSnap = await getDoc(sessionRef);
  if (!teamsSnap.exists()) return;
  const teamQuery = query(getTeamsCollection(sessionId, database));
  const teams = await getDocs(teamQuery);
  const publicAnswerQuery = query(getPublicAnswersCollection(sessionId, database));
  const publicAnswers = await getDocs(publicAnswerQuery);
  const leaderboardQuery = query(getLeaderboardCollection(sessionId, database));
  const leaderboard = await getDocs(leaderboardQuery);
  const batch = writeBatch(database);
  teams.docs.forEach((team) => batch.delete(team.ref));
  publicAnswers.docs.forEach((answer) => batch.delete(answer.ref));
  leaderboard.docs.forEach((row) => batch.delete(row.ref));
  batch.update(sessionRef, {
    status: "waiting",
    started: false,
    currentView: "waiting",
    currentQuestion: 1,
    published: false,
    explanationVisible: false,
    scoringFinalized: {},
    leaderboardVisible: false,
    teamCount: 0,
    completedCount: 0,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
