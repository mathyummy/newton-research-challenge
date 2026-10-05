import React, { useEffect, useMemo, useState } from "react";
import {
  ACTIVE_QUESTION,
  QUESTIONS,
  SESSION_ID,
} from "./questions.js";
import {
  auth,
  claimTeacherSession,
  createTeam,
  firebaseConfigured,
  listenToSession,
  listenToTeam,
  listenToTeams,
  resetSession,
  setSessionStatus,
  signInApp,
  submitAnswer,
} from "./firebase.js";

const ROUTES = { student: "/student", screen: "/screen", teacher: "/teacher" };
const TEAM_STORAGE_KEY = "newton-challenge-team-id";

function routeName() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/student";
  if (path === ROUTES.screen) return "screen";
  if (path === ROUTES.teacher) return "teacher";
  return "student";
}

function PageFrame({ eyebrow, title, description, children, role }) {
  return (
    <main className={`app-shell shell-${role}`}>
      <header className="topbar">
        <a className="brand" href={ROUTES.student} aria-label="回到學生端">
          <span className="brand-mark">N</span>
          <span>
            <span className="brand-kicker">我是小牛頓</span>
            <span className="brand-title">研究追查闖關</span>
          </span>
        </a>
        <nav className="role-nav" aria-label="切換畫面">
          <a className={role === "student" ? "active" : ""} href={ROUTES.student}>學生端</a>
          <a className={role === "screen" ? "active" : ""} href={ROUTES.screen}>大屏</a>
          <a className={role === "teacher" ? "active" : ""} href={ROUTES.teacher}>教師端</a>
        </nav>
      </header>
      <section className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="page-description">{description}</p>
          </div>
          <div className="session-chip"><span className="live-dot" />本場即時同步</div>
        </div>
        {children}
      </section>
      <footer className="footer">Phase 1 MVP · Q1 測試場 · 研究能力從「我怎麼知道？」開始</footer>
    </main>
  );
}

function FirebaseGate({ children, authUser, error }) {
  if (!firebaseConfigured) {
    return (
      <main className="setup-screen">
        <div className="setup-panel">
          <p className="eyebrow">還差最後一個設定</p>
          <h1>先連接 Firebase，才會開始同步</h1>
          <p>目前這個專案已經可以建置，但還沒有讀到 `.env` 裡的 Firebase 設定。請依 README 完成設定，再重新啟動開發伺服器。</p>
          <div className="setup-code">VITE_FIREBASE_PROJECT_ID=你的專案 ID</div>
          <a className="button button-primary" href="https://firebase.google.com/docs/web/setup" target="_blank" rel="noreferrer">查看 Firebase 設定說明</a>
        </div>
      </main>
    );
  }
  if (!authUser) {
    return (
      <main className="setup-screen">
        <div className="setup-panel loading-panel">
          <span className="spinner" />
          <h1>正在連接本場</h1>
          <p>{error || "請稍候，正在建立匿名連線。"}</p>
        </div>
      </main>
    );
  }
  if (error) {
    return (
      <main className="setup-screen">
        <div className="setup-panel">
          <p className="eyebrow eyebrow-danger">連線需要處理</p>
          <h1>目前無法連上本場</h1>
          <p>{error}</p>
          <button className="button button-primary" onClick={() => window.location.reload()}>重新連線</button>
        </div>
      </main>
    );
  }
  return children;
}

function useFirebaseAuth() {
  const [authUser, setAuthUser] = useState(null);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    if (!firebaseConfigured) return undefined;
    signInApp().then(setAuthUser).catch((err) => setAuthError(err.message || "匿名登入失敗。"));
    return () => {};
  }, []);
  const [error, setError] = useState("");
  return { authUser, authError, error, setError };
}

function useSession(authUser, setError) {
  const [session, setSession] = useState(null);
  useEffect(() => {
    if (!authUser) return undefined;
    return listenToSession(SESSION_ID, setSession, (err) => setError(err.message || "本場同步失敗。"));
  }, [authUser, setError]);
  return session;
}

function JoinTeam({ session, onJoined, setError }) {
  const [form, setForm] = useState({ className: "802", teamName: "", member1Name: "", member1Seat: "", member2Name: "", member2Seat: "" });
  const [busy, setBusy] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.teamName.trim() || !form.member1Name.trim() || !form.member1Seat.trim() || !form.member2Name.trim() || !form.member2Seat.trim()) {
      setError("請把隊名、兩位成員姓名與座號填完整。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const teamId = crypto.randomUUID();
      await createTeam(SESSION_ID, teamId, {
        className: form.className,
        teamName: form.teamName.trim(),
        members: [
          { name: form.member1Name.trim(), seat: form.member1Seat.trim() },
          { name: form.member2Name.trim(), seat: form.member2Seat.trim() },
        ],
      });
      localStorage.setItem(TEAM_STORAGE_KEY, teamId);
      onJoined(teamId);
    } catch (err) {
      setError(err.message || "加入隊伍失敗，請再試一次。");
    } finally {
      setBusy(false);
    }
  }
  const statusText = session?.status === "stopped" ? "老師已暫停加入" : "現在可以加入隊伍";
  return (
    <div className="student-grid">
      <section className="surface form-surface">
        <div className="section-heading">
          <div><p className="eyebrow">STEP 01</p><h2>加入你的研究隊伍</h2></div>
          <span className="status-badge status-ready">{statusText}</span>
        </div>
        <form className="join-form" onSubmit={handleSubmit}>
          <label>班級<select value={form.className} onChange={(event) => update("className", event.target.value)}><option>802</option><option>803</option><option>804</option><option>807</option></select></label>
          <label>隊名<input value={form.teamName} onChange={(event) => update("teamName", event.target.value)} placeholder="例如：追查小隊" maxLength={16} /></label>
          <div className="member-header"><span>成員 1</span><span>成員 2</span></div>
          <div className="member-fields">
            <fieldset><legend>成員 1</legend><label>座號<input value={form.member1Seat} onChange={(event) => update("member1Seat", event.target.value)} placeholder="座號" inputMode="numeric" /></label><label>姓名<input value={form.member1Name} onChange={(event) => update("member1Name", event.target.value)} placeholder="姓名" /></label></fieldset>
            <fieldset><legend>成員 2</legend><label>座號<input value={form.member2Seat} onChange={(event) => update("member2Seat", event.target.value)} placeholder="座號" inputMode="numeric" /></label><label>姓名<input value={form.member2Name} onChange={(event) => update("member2Name", event.target.value)} placeholder="姓名" /></label></fieldset>
          </div>
          <button className="button button-primary button-wide" disabled={busy || session?.status === "stopped"}>{busy ? "正在加入…" : "加入隊伍，開始追查"}</button>
        </form>
      </section>
      <aside className="surface info-surface">
        <p className="eyebrow">明天上課提醒</p>
        <h2>這裡先不需要登入帳號</h2>
        <p>一組兩人共用一台裝置。送出答案前會再次確認，送出後這一題就不能修改。</p>
        <div className="mini-rule"><span>01</span><div><strong>先加入隊伍</strong><small>填入兩位成員資料</small></div></div>
        <div className="mini-rule"><span>02</span><div><strong>看大屏讀題</strong><small>學生端只保留作答介面</small></div></div>
        <div className="mini-rule"><span>03</span><div><strong>送出後鎖定</strong><small>等待老師公布全班進度</small></div></div>
      </aside>
    </div>
  );
}

function StudentQuestion({ session, team, setError }) {
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const submitted = Boolean(team?.submitted?.[ACTIVE_QUESTION.id]);
  const submittedAnswer = team?.answers?.[ACTIVE_QUESTION.id]?.value;
  useEffect(() => { if (submittedAnswer) setSelected(submittedAnswer); }, [submittedAnswer]);
  function getAnswer() { return selected; }
  async function handleSubmit(event) {
    event.preventDefault();
    if (!selected) { setError("請先選一個答案。"); return; }
    if (!window.confirm("送出後不能修改，確定送出嗎？")) return;
    setBusy(true); setError("");
    try { await submitAnswer(SESSION_ID, team.id, ACTIVE_QUESTION.id, getAnswer()); }
    catch (err) { setError(err.message || "提交失敗，請再試一次。"); }
    finally { setBusy(false); }
  }
  return (
    <section className="student-question-wrap">
      <div className="question-progress"><span>Q1 / 9</span><span className="progress-track"><span style={{ width: "11.11%" }} /></span><span>LEVEL 1</span></div>
      <div className="student-question-grid">
        <div className="surface question-card">
          <div className="question-meta"><span className="question-number">01</span><span className="status-badge status-amber">{ACTIVE_QUESTION.label}</span></div>
          <p className="eyebrow">{ACTIVE_QUESTION.level}</p>
          <h2>{ACTIVE_QUESTION.prompt}</h2>
          <p className="question-helper">先和隊友討論，再由一台裝置提交一次。</p>
          {submitted ? (
            <div className="submitted-state"><span className="check-mark">✓</span><div><strong>已提交，答案已鎖定</strong><p>請看大屏，等待老師公布全班進度。</p></div></div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="option-list">{ACTIVE_QUESTION.options.map((option) => <label className={`option ${selected === option.key ? "selected" : ""}`} key={option.key}><input type="radio" name="q1" value={option.key} checked={selected === option.key} onChange={(event) => setSelected(event.target.value)} /><span className="option-key">{option.key}</span><span>{option.text}</span></label>)}</div>
              <button className="button button-primary button-wide" disabled={busy}>{busy ? "正在提交…" : "確認答案並提交"}</button>
            </form>
          )}
        </div>
        <aside className="surface team-card"><p className="eyebrow">你的隊伍</p><h2>{team?.teamName || "讀取中…"}</h2><p>{team?.className} · {team?.members?.map((member) => `${member.seat}號 ${member.name}`).join("、")}</p><div className="lock-note"><span>LOCK</span><strong>每題只能提交一次</strong><small>提交前請確認整組答案</small></div></aside>
      </div>
    </section>
  );
}

function StudentPage({ authUser, setError }) {
  const session = useSession(authUser, setError);
  const [teamId, setTeamId] = useState(() => localStorage.getItem(TEAM_STORAGE_KEY));
  const [team, setTeam] = useState(null);
  useEffect(() => {
    if (!teamId) { setTeam(null); return undefined; }
    return listenToTeam(SESSION_ID, teamId, setTeam, () => { localStorage.removeItem(TEAM_STORAGE_KEY); setTeamId(null); });
  }, [teamId]);
  const ready = Boolean(session);
  return <PageFrame role="student" eyebrow="STUDENT MODE" title={team ? "Q1，先找到能相信的說法" : "先加入隊伍，再開始追查"} description={team ? "大屏會顯示完整題目；這個畫面只保留作答與提交。" : "一組兩人、一台裝置。今晚建立的最小版本，先讓明天的第一題順利跑起來。"}>
    {setError && <div className="connection-line"><span className={`live-dot ${ready ? "" : "offline"}`} />{ready ? `本場已連線 · ${session?.teamCount || 0} 組已加入` : "等待老師啟動本場…"}</div>}
    {team ? <StudentQuestion session={session} team={team} setError={setError} /> : <JoinTeam session={session} onJoined={setTeamId} setError={setError} />}
  </PageFrame>;
}

function ScreenPage({ authUser, setError }) {
  const session = useSession(authUser, setError);
  const progress = session ? `${session.completedCount || 0} / ${session.teamCount || 0}` : "— / —";
  return <PageFrame role="screen" eyebrow="SCREEN MODE" title="全班追查進度" description="這個畫面只公布題目與全班完成進度；未公布前，不顯示任何隊伍答案。">
    <section className="screen-layout">
      <div className="screen-topline"><span className="live-label"><span className="live-dot" />LIVE SESSION</span><span>Q1 / 9</span><span className="screen-status">{session?.status === "stopped" ? "已停止作答" : "作答進行中"}</span></div>
      <div className="screen-question surface"><div className="screen-question-header"><div><p className="eyebrow">{ACTIVE_QUESTION.level}</p><h2>{ACTIVE_QUESTION.label}</h2></div><div className="screen-progress"><strong>{progress}</strong><span>已完成組數</span></div></div><h1>{ACTIVE_QUESTION.prompt}</h1><div className="screen-options">{ACTIVE_QUESTION.options.map((option) => <div className="screen-option" key={option.key}><span>{option.key}</span><p>{option.text}</p></div>)}</div></div>
      <div className="screen-bottomline"><span>請和隊友討論，完成後由一台裝置提交。</span><span className="privacy-note">答案尚未公布</span></div>
    </section>
  </PageFrame>;
}

function TeacherPage({ authUser, setError }) {
  const session = useSession(authUser, setError);
  const [teams, setTeams] = useState([]);
  const [claimed, setClaimed] = useState(false);
  useEffect(() => {
    if (!authUser) return undefined;
    claimTeacherSession(SESSION_ID, authUser).then(() => setClaimed(true)).catch((err) => setError(err.message || "教師端啟動失敗。"));
    return undefined;
  }, [authUser, setError]);
  useEffect(() => {
    if (!claimed) return undefined;
    return listenToTeams(SESSION_ID, setTeams, (err) => setError(err.message || "讀取隊伍失敗。"));
  }, [claimed, setError]);
  async function changeStatus(status) { try { await setSessionStatus(SESSION_ID, status); } catch (err) { setError(err.message || "更新狀態失敗。"); } }
  async function handleReset() { if (!window.confirm("確定重設本場？隊伍、答案、分數都會清空並回到 Q1。")) return; try { await resetSession(SESSION_ID); } catch (err) { setError(err.message || "重設失敗。"); } }
  return <PageFrame role="teacher" eyebrow="TEACHER MODE" title="教師控制台" description="手機端優先：先確認隊伍是否到齊，再控制本題開關。Phase 1 先驗證即時同步與一次提交。">
    <div className="teacher-toolbar"><div><p className="eyebrow">本場狀態</p><div className="teacher-count"><strong>{session?.completedCount || 0}</strong><span>/ {session?.teamCount || 0} 組完成 Q1</span></div></div><div className="teacher-actions"><button className="button button-secondary" onClick={() => changeStatus("answering")} disabled={session?.status === "answering"}>開始本題</button><button className="button button-danger" onClick={() => changeStatus("stopped")} disabled={session?.status === "stopped"}>停止作答</button><button className="button button-quiet" onClick={handleReset}>重設本場</button></div></div>
    <div className="phase-note"><span>PHASE 1</span><p>目前只開放 Q1、加入隊伍、即時完成數與教師偷看答案；公布、解析、排行榜、計時器會在後續 Phase 2–4 接上。</p></div>
    <section className="teacher-grid"><div className="surface roster-surface"><div className="section-heading"><div><p className="eyebrow">隊伍名單</p><h2>已加入 {teams.length} 組</h2></div><span className="status-badge status-ready">即時更新</span></div>{teams.length === 0 ? <div className="empty-state"><strong>還沒有隊伍加入</strong><p>請把 `/student` 交給學生，或先確認學生端使用相同 Firebase 專案。</p></div> : <div className="team-list">{teams.map((team) => <article className="team-row" key={team.id}><div className="team-row-main"><span className={`team-state ${team.submitted?.q1 ? "done" : "pending"}`} /><div><strong>{team.teamName}</strong><p>{team.className} · {team.members?.map((member) => `${member.seat}號 ${member.name}`).join("、")}</p></div></div><div className="team-answer">{team.submitted?.q1 ? <><small>Q1 答案</small><strong>{team.answers?.q1?.value || "—"}</strong></> : <span className="pending-text">尚未提交</span>}</div></article>)}</div>}</div><aside className="surface control-surface"><p className="eyebrow">本輪流程</p><h2>Q1 / 9</h2><div className="control-step active"><span>01</span><div><strong>作答進行中</strong><small>目前學生可提交一次</small></div></div><div className="control-step disabled"><span>02</span><div><strong>公布全班答案</strong><small>Phase 2 開放</small></div></div><div className="control-step disabled"><span>03</span><div><strong>顯示正解與解析</strong><small>Phase 2 開放</small></div></div><div className="control-step disabled"><span>04</span><div><strong>下一題／排行榜</strong><small>Phase 3–4 開放</small></div></div></aside></section>
  </PageFrame>;
}

export default function App() {
  const [route, setRoute] = useState(routeName());
  const { authUser, authError, error, setError } = useFirebaseAuth();
  useEffect(() => { const handlePopState = () => setRoute(routeName()); window.addEventListener("popstate", handlePopState); return () => window.removeEventListener("popstate", handlePopState); }, []);
  useEffect(() => { if (error) { const timer = setTimeout(() => setError(""), 10000); return () => clearTimeout(timer); } return undefined; }, [error, setError]);
  const page = useMemo(() => {
    if (route === "screen") return <ScreenPage authUser={authUser} setError={setError} />;
    if (route === "teacher") return <TeacherPage authUser={authUser} setError={setError} />;
    return <StudentPage authUser={authUser} setError={setError} />;
  }, [authUser, route, setError]);
  return <FirebaseGate authUser={authUser} error={authError}>{error ? <div className="toast-error" role="alert">{error}</div> : null}{page}</FirebaseGate>;
}
