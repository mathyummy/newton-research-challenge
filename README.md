# 我是小牛頓｜研究追查闖關 MVP

明天可上課的 Phase 2：React + Vite + Firebase Authentication（匿名登入）+ Firestore 即時同步。

目前先驗證最重要的課堂骨架：

- `/student`：學生加入班級、隊名、兩位成員姓名與座號；依題型完成單選、多選或開放題；送出前確認；送出後鎖定。
- `/screen`：大屏顯示目前題目、選項、Q幾/9、LEVEL、已完成 X/Y 組；教師公布後才顯示隊名與答案，顯示解析後才顯示正解。
- `/teacher`：教師手機端看到目前題目、隊伍、成員、每組答案與完成／未完成狀態；可開始、停止、公布答案、顯示解析、切換下一題與重設本場。

Q1–Q9 題目集中在 `src/questions.js`，目前已全部接到作答流程。Q1–Q9 的一次性計分、Q1/Q4 搶快 Bonus、累積分數與教師手動顯示排行榜已接上；FINAL 不計分、不進排行榜。

## 1. Firebase 建立步驟

1. 開啟 [Firebase Console](https://console.firebase.google.com/)，建立一個專案，例如 `newton-research-2026`。
2. 在 Project settings → Your apps → Web app 新增一個 Web App，複製 SDK 設定。
3. Authentication → Sign-in method → 啟用 **Anonymous**。
4. Firestore Database → Create database。明天上課先選與班級相同地區即可。
5. 將 `.env.example` 複製成 `.env`，把 Web App 設定填入。
6. Firestore Rules 貼上本專案的 `firestore.rules`，或部署時使用：

   ```powershell
   firebase deploy --only firestore:rules
   ```

注意：Firebase Web 設定中的 API key 不是伺服器密鑰；資料保護靠 Authentication 與 Firestore Rules。上課前請務必啟用匿名登入並部署規則。

## 2. `.env` 範例

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=newton-research-2026.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=newton-research-2026
VITE_FIREBASE_STORAGE_BUCKET=newton-research-2026.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
VITE_GOOGLE_FORM_URL=https://forms.gle/FvtEhyyyXUQjhUND8
```

`VITE_GOOGLE_FORM_URL` 已設定為本次 FINAL Google Form；學生端會以新分頁開啟。

## 3. 本機啟動

```powershell
npm install
npm run dev
```

開發伺服器會顯示網址，通常是 `http://localhost:5173`。同一個網址後加：

- `http://localhost:5173/student`
- `http://localhost:5173/screen`
- `http://localhost:5173/teacher`

建置檢查：

```powershell
npm run build
npm run preview
```

計分自動測試：

```powershell
npm run test:scoring
```

## 4. 部署

第一次部署：

```powershell
npm install -g firebase-tools
firebase login
firebase use --add
npm run build
firebase deploy --only hosting,firestore:rules
```

部署後，使用同一個網站網址加上 `/student`、`/screen`、`/teacher`。Firebase Hosting 已在 `firebase.json` 設定 SPA rewrite，所以重新整理這三個網址仍會回到 React 應用。

## 5. 明天上課前測試清單

- [ ] `.env` 六個 Firebase 欄位都有值，且不是 `your_...` 佔位字串。
- [ ] Firebase Authentication 的 Anonymous 已啟用。
- [ ] Firestore rules 已部署，網站重新整理後不再出現「尚未設定 Firebase」。
- [ ] 教師先開 `/teacher`，確認看到本場狀態與「還沒有隊伍加入」。
- [ ] 大屏開 `/screen`，確認顯示 Q1 與 `0 / 0`，且是明亮投影模式。
- [ ] 用兩台學生裝置加入兩組不同隊伍，教師端即時出現兩組。
- [ ] 學生加入後只看到「等待老師開始競賽」，學生端與大屏都尚未顯示 Q1。
- [ ] 教師按「開始競賽」後，學生端與大屏才同步出現 Q1。
- [ ] 學生甲提交 Q1 後，學生端顯示「已提交，答案已鎖定」。
- [ ] 教師端完成數從 `0 / 2` 變成 `1 / 2`；大屏也同步變成 `1 / 2`。
- [ ] 重新整理學生甲頁面，Q1 仍不能重新作答。
- [ ] 教師按「停止作答」後，未提交隊伍不能送出。
- [ ] 教師按「公布全班答案」，大屏才顯示隊名與答案，且不顯示姓名座號。
- [ ] 教師按「顯示正解與解析」，大屏才顯示正解與解析。
- [ ] 教師按「下一題」，大屏、學生端與教師端一起切換到 Q2，完成數回到 `0 / 目前組數`。
- [ ] 測試 Q5 多選至少 3 個、Q6 開放文字、Q4 搶快題介面是否能提交。
- [ ] 執行 `npm run test:scoring`，確認 Q1/Q4 前三組答對 Bonus、Q5 多選、重複計分與最高 10 分測試通過。
- [ ] 教師停止 Q1 或 Q4 後，確認教師端看到基本分、Bonus、累積分數；按「顯示目前排行榜」後大屏才顯示排行榜。
- [ ] 測試「重設本場」：二次確認後隊伍、答案與完成數清空並回到 Q1。
- [ ] 若修改過 Rules，重新部署 `firestore.rules` 後再測一次公布答案。
- [ ] 用教室實際 Wi-Fi、投影機與手機瀏覽器測一次，不只測開發電腦。

## 6. 明天的備援方案

如果 Firebase 或網路在上課前出問題：

1. 保留 `/screen` 的題目簡報或直接把 Q1 題目投影出來。
2. 學生用紙本或白板寫 A/B/C/D；教師用黑板記錄各組完成情形。
3. 教師端的答案表可以用紙本代替，先保住「先判斷、再追查」的課堂流程。
4. 不要在上課現場臨時改 Firebase rules、換專案或加入新功能；先用紙本完成 Q1，再於課後修復。

## 7. 目前資料模型與限制

- 一個固定本場 `sessions/tomorrow-class`。
- 隊伍在 `sessions/tomorrow-class/teams/{teamId}`。
- 大屏公開投影資料在 `sessions/tomorrow-class/publicAnswers/{teamId_questionId}`，只存隊名與答案，不存成員姓名座號。
- 排行榜資料在 `sessions/tomorrow-class/leaderboard/{teamId}`，只存隊名與 Q1–Q9 累積分數，不存成員姓名座號。
- `teamCount` 與 `completedCount` 存在 session 文件，供大屏即時顯示 X/Y。
- `currentQuestion`、`published`、`explanationVisible`、`scoringFinalized`、`leaderboardVisible` 存在 session 文件，控制三端目前題目、公布、計分完成與排行榜顯示狀態。
- 每組 team 文件有 `score` 與 `scoring.{questionId}`；教師停止作答時執行一次 `finalizeScoring()`，同題再次呼叫不會重複加分。
- 「重設本場」會刪除本場所有隊伍、公開答案、排行榜並將分數、計數與計分完成狀態歸零。
- 教師端第一次開啟會取得本場的匿名 teacher UID；請教師在學生加入前先開啟 `/teacher`。
- 這是單班、單場 MVP。若同一 Firebase 專案同時開多個班，需在 Phase 4 再加入可切換 session code。
