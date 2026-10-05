import React, { useEffect, useMemo, useState } from "react";
import {
  QUESTIONS,
  SESSION_ID,
} from "./questions.js";
import {
  auth,
  advanceQuestion,
  claimTeacherSession,
  createTeam,
  firebaseConfigured,
  finalizeScoring,
  listenToPublicAnswers,
  listenToLeaderboard,
  listenToSession,
  listenToTeam,
  listenToTeams,
  resetSession,
  setSessionStatus,
  setSessionView,
  signInApp,
  submitAnswer,
} from "./firebase.js";
import { STAGE_VIEWS, getStageContent } from "./stages.js";

const ROUTES = { student: "/student", screen: "/screen", teacher: "/teacher" };
const TEAM_STORAGE_KEY = "newton-challenge-team-id";

function getCurrentQuestion(session) {
  const questionNumber = Number(session?.currentQuestion) || 1;
  return QUESTIONS[questionNumber - 1] || QUESTIONS[0];
}

function formatAnswer(answer) {
  if (Array.isArray(answer)) return answer.join("、");
  return answer || "—";
}

function getCurrentView(session) {
  if (session?.currentView) return session.currentView;
  return session?.started ? STAGE_VIEWS.QUESTION : "waiting";
}

function isStageView(view) {
  return Boolean(getStageContent(view));
}

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
      <footer className="footer">Phase 2 MVP · Q1–Q9 測試場 · 研究能力從「我怎麼知道？」開始</footer>
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
  const question = getCurrentQuestion(session);
  const [selected, setSelected] = useState(question.type === "multi" ? [] : "");
  const [busy, setBusy] = useState(false);
  const submitted = Boolean(team?.submitted?.[question.id]);
  const submittedAnswer = team?.answers?.[question.id]?.value;
  const isMulti = question.type === "multi";
  const isOpen = question.type === "open";
  const canAnswer = session?.status === "answering";
  useEffect(() => {
    if (submittedAnswer !== undefined) setSelected(submittedAnswer);
    else setSelected(isMulti ? [] : "");
  }, [question.id, submittedAnswer, isMulti]);
  function toggleOption(key) {
    setSelected((current) => {
      const values = Array.isArray(current) ? current : [];
      return values.includes(key) ? values.filter((item) => item !== key) : [...values, key];
    });
  }
  function hasAnswer() {
    if (isMulti) return selected.length > 0;
    return Boolean(String(selected).trim());
  }
  async function handleSubmit(event) {
    event.preventDefault();
    if (!hasAnswer()) { setError(isMulti ? "請至少選一個選項。" : "請先完成作答。"); return; }
    if (isMulti && selected.length < 3) { setError("這一題請至少選 3 個選項。"); return; }
    if (!window.confirm("送出後不能修改，確定送出嗎？")) return;
    setBusy(true); setError("");
    try { await submitAnswer(SESSION_ID, team.id, question.id, selected); }
    catch (err) { setError(err.message || "提交失敗，請再試一次。"); }
    finally { setBusy(false); }
  }
  return (
    <section className="student-question-wrap">
      <div className="question-progress"><span>Q{question.number} / {QUESTIONS.length}</span><span className="progress-track"><span style={{ width: `${(question.number / QUESTIONS.length) * 100}%` }} /></span><span>{question.level.split("｜")[0]}</span></div>
      <div className="student-question-grid">
        <div className="surface question-card">
          <div className="question-meta"><span className="question-number">{String(question.number).padStart(2, "0")}</span><span className="status-badge status-amber">{question.label}</span></div>
          <p className="eyebrow">本頁同步顯示題目</p>
          <h2 className="student-prompt">{question.prompt}</h2>
          <p className="question-helper">和隊友討論後作答；大屏會同步顯示相同內容。</p>
          {submitted ? (
            <div className="submitted-state"><span className="check-mark">✓</span><div><strong>Q{question.number} 已提交，答案已鎖定</strong><p>請看大屏，等待老師公布全班進度。</p></div></div>
          ) : (
            <form onSubmit={handleSubmit}>
              {isOpen ? <textarea className="answer-textarea" value={typeof selected === "string" ? selected : ""} onChange={(event) => setSelected(event.target.value)} placeholder="輸入你會使用的搜尋詞" rows="4" aria-label="開放題答案" /> : <div className="option-list option-list-student">{(question.options || []).map((option) => { const checked = isMulti ? selected.includes(option.key) : selected === option.key; return <label className={`option option-student answer-color-${option.key.toLowerCase()} ${checked ? "selected" : ""}`} key={option.key}><input type={isMulti ? "checkbox" : "radio"} name={question.id} value={option.key} aria-label={`選項 ${option.key}：${option.text}`} checked={checked} onChange={() => isMulti ? toggleOption(option.key) : setSelected(option.key)} /><span className="option-key option-key-large">{option.key}</span><span className="option-text">{option.text}</span></label>; })}</div>}
              <button className="button button-primary button-wide" disabled={busy || !canAnswer}>{busy ? "正在提交…" : canAnswer ? "確認答案並提交" : "等待老師重新開始"}</button>
            </form>
          )}
        </div>
        <aside className="surface team-card"><p className="eyebrow">你的隊伍</p><h2>{team?.teamName || "讀取中…"}</h2><p>{team?.className} · {team?.members?.map((member) => `${member.seat}號 ${member.name}`).join("、")}</p><div className="lock-note"><span>LOCK</span><strong>每題只能提交一次</strong><small>{isMulti ? "至少選 3 個後再提交" : isOpen ? "提交文字後不能修改" : "提交前請確認整組答案"}</small></div><div className="student-score-note"><span>目前分數（只在每題計分完成後更新）</span><strong>{team?.score || 0} / 10</strong></div></aside>
      </div>
    </section>
  );
}

function WaitingRoom({ session, team }) {
  return (
    <section className="waiting-room surface">
      <div className="waiting-orbit" aria-hidden="true"><span /></div>
      <p className="eyebrow">隊伍已加入</p>
      <h2>等待老師開始競賽</h2>
      <p>你的隊伍「{team?.teamName}」已經準備好了。老師按下「開始本題」後，第一題才會出現。</p>
      <div className="waiting-meta"><span className="live-dot offline" />目前還不能作答 · {session?.teamCount || 0} 組已加入</div>
    </section>
  );
}

function StudentStage({ view }) {
  const content = getStageContent(view);
  const formUrl = import.meta.env.VITE_FINAL_FORM_URL || import.meta.env.VITE_GOOGLE_FORM_URL || "";
  if (!content) return null;
  if (view === STAGE_VIEWS.FINAL_TRANSITION) {
    return <section className="student-stage surface student-stage-final"><span className="stage-check">✓</span><p className="eyebrow">FINAL TRANSITION</p><h2>FINAL 即將開始</h2><p>請先看大屏</p></section>;
  }
  if (view === STAGE_VIEWS.FINAL || view === STAGE_VIEWS.FINAL_HINT) {
    const finalContent = getStageContent(STAGE_VIEWS.FINAL);
    return <section className="student-stage surface student-stage-final student-final-stage">
      <div className="student-final-header">
        <span className="stage-check">✓</span>
        <p className="eyebrow">FINAL</p>
        <h2>FINAL｜真的把研究追回來</h2>
        <div className="student-final-score">10 分</div>
        <p>這一關不比速度</p>
      </div>
      {view === STAGE_VIEWS.FINAL_HINT ? <div className="student-final-notice" role="status">老師已顯示卡關提示，請看大屏。</div> : null}
      <div className="student-final-scroll">
        <section className="student-final-clue-card">
          <p className="eyebrow">研究線索</p>
          {finalContent.sections.map((section, index) => <div className="student-final-clue" key={`${section.label}-${index}`}>
            {section.label ? <strong>{section.label}</strong> : null}
            <p>{section.text}</p>
          </div>)}
        </section>
        <section className="student-final-task">
          <p className="eyebrow">任務</p>
          <p>把這則消息背後的<br />「那篇原始研究」<br />追回來。</p>
          <p>找到後，<br />到 FINAL Google 表單提交。</p>
        </section>
        <section className="student-final-reminder">
          <p className="eyebrow">小提醒</p>
          <p>搜尋時可以把你覺得有用的線索組合起來。</p>
          <p>找到研究後，先確認：</p>
          <ul><li>研究題名</li><li>作者／研究團隊</li><li>年份</li><li>期刊</li><li>研究對象</li></ul>
          <small>這不是在提供標準搜尋句，只是提醒你最後要確認研究身分。</small>
        </section>
      </div>
      {formUrl ? <a className="button button-primary final-form-link" href={formUrl} target="_blank" rel="noreferrer">開啟 FINAL Google 表單</a> : <p className="final-form-missing">FINAL 表單尚未設定，請告訴老師。</p>}
    </section>;
  }
  return <section className={`student-stage surface ${view === STAGE_VIEWS.FINAL_HINT ? "student-stage-final" : ""}`}>
    <span className="stage-check">✓</span>
    <p className="eyebrow">{view.startsWith("debrief") || view === STAGE_VIEWS.CONCEPT_SUMMARY ? "課堂收束" : "本階段完成"}</p>
    <h2>請看教室大屏</h2>
    <p>等待老師繼續</p>
  </section>;
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
  const question = getCurrentQuestion(session);
  const view = getCurrentView(session);
  const title = !team ? "先加入隊伍，再開始追查" : view === STAGE_VIEWS.QUESTION ? `Q${question.number}，繼續研究追查` : "研究追查進行中";
  const description = !team ? "一組兩人、一台裝置。今晚建立的最小版本，先讓明天的第一題順利跑起來。" : view === STAGE_VIEWS.QUESTION ? "大屏會顯示完整題目；這個畫面也同步保留題目與選項，方便作答。" : "請依照教師端與教室大屏的節奏進行。";
  return <PageFrame role="student" eyebrow="STUDENT MODE" title={title} description={description}>
    {setError && <div className="connection-line"><span className={`live-dot ${ready ? "" : "offline"}`} />{ready ? `本場已連線 · ${session?.teamCount || 0} 組已加入` : "等待老師啟動本場…"}</div>}
    {team ? (view === "waiting" || !session?.started ? <WaitingRoom session={session} team={team} /> : view === STAGE_VIEWS.QUESTION ? <StudentQuestion session={session} team={team} setError={setError} /> : <StudentStage view={view} />) : <JoinTeam session={session} onJoined={setTeamId} setError={setError} />}
  </PageFrame>;
}

function ScreenStage({ view }) {
  const content = getStageContent(view);
  if (!content) return null;
  if (view === STAGE_VIEWS.FINAL) {
    return <div className="screen-stage surface screen-stage-final-simple">
      <p className="eyebrow">FINAL</p>
      <h1>FINAL｜真的把研究追回來</h1>
      <div className="stage-lines"><div className="stage-line">10 分</div><div className="stage-line">不比速度</div></div>
      <p className="stage-support">研究線索請看自己的螢幕。</p>
      <p className="stage-support">任務：把「那篇原始研究」追回來，找到後填 FINAL Google 表單。</p>
      <div className="screen-final-core-clues"><span>12～13 歲</span><span>UCSF</span><span>Sleep Health</span></div>
    </div>;
  }
  return <div className={`screen-stage surface screen-stage-${content.kind}`}>
    <p className="eyebrow">{content.eyebrow}</p>
    <h1>{content.title}</h1>
    {content.lines?.length ? <div className="stage-lines">{content.lines.map((line, index) => <div className={`stage-line ${line === "≠" ? "stage-equation" : index === 0 && content.kind === "summary" ? "stage-summary-label" : ""}`} key={`${line}-${index}`}>{line}</div>)}</div> : null}
    {content.sections?.length ? <div className="stage-sections">{content.sections.map((section, index) => <div className="stage-section" key={`${section.label}-${index}`}><strong>{section.label}</strong><p>{section.text}</p></div>)}</div> : null}
    {content.score ? <div className="stage-summary-score">{content.score}</div> : null}
    {content.support ? <p className="stage-support">{content.support}</p> : null}
    {content.hint ? <p className="stage-hint">{content.hint}</p> : null}
  </div>;
}

function LeaderboardPanel({ rows }) {
  return <section className="screen-leaderboard surface">
    <div className="published-heading"><p className="eyebrow">目前排行榜 · Q1–Q9</p><span>不含 FINAL</span></div>
    {rows.length === 0 ? <p className="published-empty">目前還沒有已完成計分的隊伍。</p> : <div className="leaderboard-list">{rows.map((row) => <div className="leaderboard-row" key={row.teamId}><strong>{row.rank}</strong><span>{row.teamName}</span><b>{row.score} 分</b></div>)}</div>}
  </section>;
}

function TeacherTeamRow({ team, question, scoringFinalized }) {
  const submitted = Boolean(team.submitted?.[question.id]);
  const value = team.answers?.[question.id]?.value;
  const scoring = team.scoring?.[question.id];
  return <article className="team-row">
    <div className="team-row-main"><span className={`team-state ${submitted ? "done" : "pending"}`} /><div><strong>{team.teamName}</strong><p>{team.className} · {team.members?.map((member) => `${member.seat}號 ${member.name}`).join("、")}</p></div></div>
    <div className="team-answer">{submitted ? <><small>Q{question.number} 答案</small><strong className="team-answer-value">{formatAnswer(value)}</strong></> : <span className="pending-text">尚未提交</span>}</div>
    {scoringFinalized && scoring ? <div className="team-score-details"><span>{scoring.correct ? "✓ 正確" : "✕ 錯誤"}</span><span>基本分：{scoring.baseScore}</span>{question.type === "speed" ? <span>⚡ Bonus：{scoring.speedBonus}</span> : null}<b>累積：{team.score || 0}</b></div> : null}
  </article>;
}

function ScreenPage({ authUser, setError }) {
  const session = useSession(authUser, setError);
  const question = getCurrentQuestion(session);
  const [publicAnswers, setPublicAnswers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  useEffect(() => {
    if (!session?.published) { setPublicAnswers([]); return undefined; }
    return listenToPublicAnswers(SESSION_ID, setPublicAnswers, (err) => setError(err.message || "讀取公布答案失敗。"));
  }, [session?.published, setError]);
  useEffect(() => {
    if (!session?.leaderboardVisible) { setLeaderboard([]); return undefined; }
    return listenToLeaderboard(SESSION_ID, setLeaderboard, (err) => setError(err.message || "讀取排行榜失敗。"));
  }, [session?.leaderboardVisible, setError]);
  const progress = session ? `${session.completedCount || 0} / ${session.teamCount || 0}` : "— / —";
  const visibleAnswers = publicAnswers.filter((answer) => answer.questionId === question.id);
  const started = Boolean(session?.started);
  const view = getCurrentView(session);
  const stageContent = getStageContent(view);
  const screenStatus = !started ? "等待老師開始競賽" : stageContent ? stageContent.eyebrow : session?.status === "stopped" ? "已停止作答" : "作答進行中";
  return <PageFrame role="screen" eyebrow="SCREEN MODE" title="全班追查進度" description="這個畫面只公布題目與全班完成進度；未公布前，不顯示任何隊伍答案。">
    <section className="screen-layout">
      <div className="screen-topline"><span className="live-label"><span className="live-dot" />LIVE SESSION</span><span>{stageContent ? stageContent.eyebrow : `Q${question.number} / ${QUESTIONS.length}`}</span><span className="screen-status">{screenStatus}</span></div>
      {!started ? <div className="screen-waiting surface"><p className="eyebrow">準備開始</p><h1>等待老師開始競賽</h1><p>請各組先完成加入。老師按下「開始本題」後，第一題會同步出現在大屏與學生端。</p><div className="screen-waiting-count"><strong>{session?.teamCount || 0}</strong><span>組已加入</span></div></div> : stageContent ? <ScreenStage view={view} /> : <div className="screen-question surface"><div className="screen-question-header"><div><p className="eyebrow">{question.level}</p><h2>{question.label}</h2></div><div className="screen-progress"><strong>{progress}</strong><span>已完成組數</span></div></div><h1>{question.prompt}</h1>{question.type === "open" ? <div className="screen-open-note">開放題：請各組在學生端輸入搜尋詞，送出後等待老師公布。</div> : <div className="screen-options">{(question.options || []).map((option) => <div className={`screen-option answer-color-${option.key.toLowerCase()}`} key={option.key}><span>{option.key}</span><p>{option.text}</p></div>)}</div>}{session?.published ? <section className="published-answers"><div className="published-heading"><p className="eyebrow">全班答案</p><span>{visibleAnswers.length} 組已提交</span></div>{visibleAnswers.length === 0 ? <p className="published-empty">目前沒有可顯示的答案。</p> : <div className="published-list">{visibleAnswers.map((answer) => <div className="published-answer" key={answer.id}><strong>{answer.teamName}</strong><span>{formatAnswer(answer.value)}</span></div>)}</div>}</section> : null}{session?.explanationVisible ? <section className="screen-explanation"><div><p className="eyebrow">正解與解析</p><strong>正解：{formatAnswer(question.answer)}</strong></div><p>{question.explanation}</p></section> : null}</div>}
      {session?.leaderboardVisible ? <LeaderboardPanel rows={leaderboard} /> : null}
      <div className="screen-bottomline"><span>{!started ? "等待老師開始競賽。" : stageContent ? "請依照老師指示，等待進入下一階段。" : session?.explanationVisible ? "老師正在講解本題。" : session?.published ? "請觀察各組答案，再聽老師公布正解。" : "請和隊友討論，完成後由一台裝置提交。"}</span><span className="privacy-note">{!started ? "尚未開始" : stageContent ? "教師手動控制" : session?.explanationVisible ? "已顯示解析" : session?.published ? "全班答案已公布" : "答案尚未公布"}</span></div>
    </section>
  </PageFrame>;
}

function TeacherPage({ authUser, setError }) {
  const session = useSession(authUser, setError);
  const question = getCurrentQuestion(session);
  const view = getCurrentView(session);
  const stageContent = getStageContent(view);
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
  async function changeStatus(status) { try { await setSessionStatus(SESSION_ID, status); if (status === "stopped" && view === STAGE_VIEWS.QUESTION) await finalizeScoring(SESSION_ID, question.id); } catch (err) { setError(err.message || "更新狀態或計分失敗。"); } }
  async function changeView(changes) { try { await setSessionView(SESSION_ID, changes); } catch (err) { setError(err.message || "更新流程失敗。"); } }
  async function publishAnswers() { try { await finalizeScoring(SESSION_ID, question.id); await changeView({ published: true }); } catch (err) { setError(err.message || "公布答案或計分失敗。"); } }
  async function toggleLeaderboard() { try { await changeView({ leaderboardVisible: !session?.leaderboardVisible }); } catch (err) { setError(err.message || "更新排行榜顯示狀態失敗。"); } }
  async function nextQuestion() { if (!session || question.number >= QUESTIONS.length) return; try { await advanceQuestion(SESSION_ID, question.number + 1); } catch (err) { setError(err.message || "切換題目失敗。"); } }
  async function showStage(nextView) { await changeView({ currentView: nextView, status: "stopped", published: false, explanationVisible: false, leaderboardVisible: false }); }
  async function handleReset() { if (!window.confirm(`確定立即重設本場？目前第 ${question.number} 題也會中止，隊伍、答案、分數都會清空並回到等待開始。`)) return; try { await resetSession(SESSION_ID); } catch (err) { setError(err.message || "重設失敗。"); } }
  let primaryAction = null;
  let primaryClass = "button button-secondary teacher-primary-action";
  let nextLabel = "等待教師端連線";
  if (session) {
    if (view === "waiting") { primaryAction = () => changeStatus("answering"); nextLabel = "開始第一題"; }
    else if (view === STAGE_VIEWS.QUESTION && session.status === "answering") { primaryAction = () => changeStatus("stopped"); primaryClass = "button button-danger teacher-primary-action"; nextLabel = "停止作答"; }
    else if (view === STAGE_VIEWS.QUESTION && session.status === "stopped" && !session.published) { primaryAction = publishAnswers; nextLabel = question.type === "open" ? "公布全班搜尋詞" : "公布全班答案"; }
    else if (view === STAGE_VIEWS.QUESTION && session.published && !session.explanationVisible) { primaryAction = () => changeView({ explanationVisible: true }); nextLabel = "顯示正解與解析"; }
    else if (view === STAGE_VIEWS.QUESTION && session.explanationVisible) {
      if (question.number === 3) { primaryAction = () => showStage(STAGE_VIEWS.CHECKPOINT_1); nextLabel = "顯示 LEVEL 1 收束"; }
      else if (question.number === 6) { primaryAction = () => showStage(STAGE_VIEWS.CHECKPOINT_2); nextLabel = "顯示 LEVEL 2 收束"; }
      else if (question.number === 9) { primaryAction = () => showStage(STAGE_VIEWS.CHECKPOINT_3); nextLabel = "顯示 LEVEL 3 收束"; }
      else { primaryAction = nextQuestion; nextLabel = "進入下一題"; }
    } else if (view === STAGE_VIEWS.CHECKPOINT_1) { primaryAction = () => nextQuestion(); nextLabel = "進入 LEVEL 2"; }
    else if (view === STAGE_VIEWS.CHECKPOINT_2) { primaryAction = () => nextQuestion(); nextLabel = "進入 LEVEL 3"; }
    else if (view === STAGE_VIEWS.CHECKPOINT_3) { primaryAction = () => showStage(STAGE_VIEWS.SCORE_SUMMARY); nextLabel = "看前九題結算"; }
    else if (view === STAGE_VIEWS.SCORE_SUMMARY) { primaryAction = () => showStage(STAGE_VIEWS.FINAL_TRANSITION); nextLabel = "進入 FINAL"; }
    else if (view === STAGE_VIEWS.FINAL_TRANSITION) { primaryAction = () => showStage(STAGE_VIEWS.FINAL); nextLabel = "顯示 FINAL 線索"; }
    else if (view === STAGE_VIEWS.FINAL) { primaryAction = () => showStage(STAGE_VIEWS.FINAL_HINT); nextLabel = "顯示卡關提示"; }
    else if (view === STAGE_VIEWS.FINAL_HINT) { primaryAction = () => showStage(STAGE_VIEWS.FINAL); nextLabel = "回到 FINAL 線索"; }
    else if (view === STAGE_VIEWS.DEBRIEF_QUESTION_1) { primaryAction = () => showStage(STAGE_VIEWS.DEBRIEF_QUESTION_1_ANSWER); nextLabel = "顯示答案"; }
    else if (view === STAGE_VIEWS.DEBRIEF_QUESTION_1_ANSWER) { primaryAction = () => showStage(STAGE_VIEWS.DEBRIEF_QUESTION_2); nextLabel = "進入收束問題 2"; }
    else if (view === STAGE_VIEWS.DEBRIEF_QUESTION_2) { primaryAction = () => showStage(STAGE_VIEWS.DEBRIEF_QUESTION_2_ANSWER); nextLabel = "顯示答案"; }
    else if (view === STAGE_VIEWS.DEBRIEF_QUESTION_2_ANSWER) { primaryAction = () => showStage(STAGE_VIEWS.CONCEPT_SUMMARY); nextLabel = "顯示最終概念收束"; }
    else if (view === STAGE_VIEWS.CONCEPT_SUMMARY) { nextLabel = "本場收束完成"; }
  }
  const displayStage = stageContent || { eyebrow: `Q${question.number}`, title: `第 ${question.number} 題` };
  const finalViews = [STAGE_VIEWS.FINAL, STAGE_VIEWS.FINAL_HINT, STAGE_VIEWS.DEBRIEF_QUESTION_1, STAGE_VIEWS.DEBRIEF_QUESTION_1_ANSWER, STAGE_VIEWS.DEBRIEF_QUESTION_2, STAGE_VIEWS.DEBRIEF_QUESTION_2_ANSWER, STAGE_VIEWS.CONCEPT_SUMMARY];
  const isFinalStage = finalViews.includes(view);
  const stageBrief = stageContent ? <section className="surface teacher-brief teacher-stage-brief"><div className="teacher-brief-heading"><div><p className="eyebrow">{displayStage.eyebrow}</p><h2>{displayStage.title}</h2></div><span className="status-badge status-ready">教師手動控制</span></div><div className="teacher-stage-lines">{displayStage.lines?.map((line, index) => <span className={line === "≠" ? "teacher-stage-equation" : ""} key={`${line}-${index}`}>{line}</span>)}</div>{displayStage.sections?.length ? <div className="teacher-stage-sections">{displayStage.sections.map((section, index) => <div key={`${section.label}-${index}`}><strong>{section.label}</strong><p>{section.text}</p></div>)}</div> : null}{displayStage.support ? <p className="teacher-explanation">{displayStage.support}</p> : null}{displayStage.hint ? <p className="teacher-stage-hint">{displayStage.hint}</p> : null}{displayStage.teacherNotes?.length ? <div className="teacher-stage-notes"><strong>教師巡視提示</strong>{displayStage.teacherNotes.map((note) => <p key={note}>{note}</p>)}</div> : null}</section> : <section className="surface teacher-brief"><div className="teacher-brief-heading"><div><p className="eyebrow">教師講解卡 · Q{question.number}</p><h2>{question.prompt}</h2></div><span className="status-badge status-amber">正解 {formatAnswer(question.answer)}</span></div><p className="teacher-explanation">{question.explanation}</p></section>;
  return <PageFrame role="teacher" eyebrow="TEACHER MODE" title="教師控制台" description="手機端優先：控制作答節奏，並用單一下一步按鈕帶領全班完成分段收束。">
    <div className="teacher-toolbar"><div><p className="eyebrow">本場狀態 · {stageContent ? displayStage.eyebrow : `Q${question.number} / ${QUESTIONS.length}`}</p><div className="teacher-count"><strong>{isFinalStage ? (session?.teamCount || 0) : (session?.completedCount || 0)}</strong><span>{isFinalStage ? "目前本場組數" : `/ ${session?.teamCount || 0} 組完成本題`}</span></div><p className="teacher-next-label">下一步：{nextLabel}</p></div><div className="teacher-actions">{primaryAction ? <button className={primaryClass} onClick={primaryAction}>{nextLabel}</button> : null}{Object.keys(session?.scoringFinalized || {}).length > 0 ? <button className="button button-secondary" onClick={toggleLeaderboard}>{session?.leaderboardVisible ? "隱藏排行榜" : "顯示目前排行榜"}</button> : null}{view === STAGE_VIEWS.FINAL ? <button className="button button-quiet" onClick={() => showStage(STAGE_VIEWS.DEBRIEF_QUESTION_1)}>結束 FINAL／進入收束</button> : null}<button className="button button-quiet" onClick={handleReset}>重設本場</button></div></div>
    <div className="phase-note"><span>PHASE 3</span><p>Q1–Q3、Q4–Q6、Q7–Q9 各自完成後，教師手動進入概念收束；不自動跳題、不在 checkpoint 計分。</p></div>
    {stageBrief}
    <section className="teacher-grid"><div className="surface roster-surface"><div className="section-heading"><div><p className="eyebrow">隊伍名單 · 教師可見</p><h2>已加入 {teams.length} 組</h2></div><span className="status-badge status-ready">即時更新</span></div>{teams.length === 0 ? <div className="empty-state"><strong>還沒有隊伍加入</strong><p>請把 `/student` 交給學生，或先確認學生端使用相同 Firebase 專案。</p></div> : <div className="team-list">{teams.map((team) => <TeacherTeamRow key={team.id} team={team} question={question} scoringFinalized={Boolean(session?.scoringFinalized?.[question.id])} />)}</div>}</div><aside className="surface control-surface"><p className="eyebrow">目前流程</p><h2>{displayStage.eyebrow}</h2><div className={`control-step ${view === STAGE_VIEWS.QUESTION && session?.status === "answering" ? "active" : ""}`}><span>01</span><div><strong>{view === STAGE_VIEWS.QUESTION ? "本題作答" : "目前階段"}</strong><small>{view === STAGE_VIEWS.QUESTION ? (session?.status === "answering" ? "學生目前可以提交" : "等待教師公布或顯示解析") : displayStage.title}</small></div></div><div className="control-step active"><span>02</span><div><strong>下一步</strong><small>{nextLabel}</small></div></div><div className="control-step"><span>03</span><div><strong>學生端</strong><small>{isStageView(view) ? "顯示等待老師繼續" : "依目前題目作答"}</small></div></div></aside></section>
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
