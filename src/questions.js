export const QUESTIONS = [
  {
    id: "q1",
    number: 1,
    level: "LEVEL 1｜留下第一條線索",
    type: "speed",
    label: "⚡搶快題",
    prompt: `一篇網站文章寫：

「研究指出，睡眠不足可能影響學生的學習表現。」

現在我們已經找到「那篇研究」了嗎？`,
    options: [
      { key: "A", text: "找到了，因為文章有寫「研究指出」" },
      { key: "B", text: "還沒有，只知道有人說有研究" },
      { key: "C", text: "找到了，因為網站敢寫就代表有根據" },
    ],
    answer: "B",
    explanation: "「有人說有研究」不等於「我們已經找到研究」。",
  },
  {
    id: "q2",
    number: 2,
    level: "LEVEL 1｜辨認研究本身",
    type: "accuracy",
    label: "🎯準確題",
    prompt: "哪一個最接近我們要找的「研究本身」？",
    options: [
      { key: "A", text: "【新聞】\n「最新研究發現，青少年滑手機可能影響睡眠。」" },
      { key: "B", text: "【健康網站】\n「多項研究顯示，螢幕使用可能與睡眠有關。」" },
      { key: "C", text: "【研究頁面】\n研究題名\n作者\n年份\n期刊名稱" },
    ],
    answer: "C",
    explanation: "不是因為 C 看起來比較厲害，而是它已經讓我們有機會辨認「到底是哪篇研究」。",
  },
  {
    id: "q3",
    number: 3,
    level: "LEVEL 1｜新聞只是線索",
    type: "accuracy",
    label: "🎯準確題",
    prompt: `你搜尋之後，又找到另一篇新聞。

它也寫：

「研究發現青少年睡眠和手機使用有關。」

現在怎麼判斷比較合理？`,
    options: [
      { key: "A", text: "兩篇新聞都這樣說，所以研究一定是真的" },
      { key: "B", text: "還沒有找到研究，但多了一條可能繼續追的線索" },
      { key: "C", text: "兩篇新聞就等於兩篇研究" },
    ],
    answer: "B",
    explanation: "多一篇轉述，不等於多一篇研究。",
  },
  {
    id: "q4",
    number: 4,
    level: "LEVEL 2｜追回特定研究",
    type: "speed",
    label: "⚡搶快題",
    prompt: `【教學模擬新聞】

2025 年，某大學研究團隊調查青少年的螢幕使用與睡眠情形，研究結果刊登於《Sleep Health》。研究團隊表示，較長的螢幕使用時間與較差的睡眠狀況有關。

如果要追回「這篇研究」，下面哪個資訊最有辨識力？`,
    options: [
      { key: "A", text: "「研究發現」" },
      { key: "B", text: "Sleep Health" },
      { key: "C", text: "「睡眠不好」" },
      { key: "D", text: "「青少年」" },
    ],
    answer: "B",
    explanation: "Sleep Health 現在可以先當成一個「名字」，直接拿去搜尋，不需要先翻譯。",
  },
  {
    id: "q5",
    number: 5,
    level: "LEVEL 2｜組合辨識線索",
    type: "multi",
    label: "☑ 複選題",
    prompt: `【教學模擬新聞】

2025 年，某大學研究團隊調查青少年的螢幕使用與睡眠情形，研究結果刊登於《Sleep Health》。研究團隊表示，較長的螢幕使用時間與較差的睡眠狀況有關。

哪些資訊可以幫你縮小到原本那篇研究？`,
    options: [
      { key: "A", text: "2025" },
      { key: "B", text: "某大學研究團隊" },
      { key: "C", text: "Sleep Health" },
      { key: "D", text: "青少年" },
      { key: "E", text: "「研究結果很重要」" },
    ],
    answer: ["A", "B", "C", "D"],
    scoring: {
      minSelections: 3,
      requiredKeys: ["A", "B", "C", "D"],
      forbiddenKeys: ["E"],
      points: 1,
    },
    explanation: "不是找一個神奇關鍵字，而是把手上的線索組起來。",
  },
  {
    id: "q6",
    number: 6,
    level: "LEVEL 2｜把線索組成搜尋詞",
    type: "open",
    label: "💬開放題",
    prompt: `【教學模擬新聞】

2025 年，某大學研究團隊調查青少年的螢幕使用與睡眠情形，研究結果刊登於《Sleep Health》。研究團隊表示，較長的螢幕使用時間與較差的睡眠狀況有關。

如果現在真的要找出「這篇研究」，
你們會在搜尋框輸入什麼？

請輸入你們真正會搜尋的文字。`,
    answer: null,
    scoring: { points: 0 },
    explanation: `找這個主題 ≠ 找這篇研究

找「這篇研究」時，可以把年份、研究機構、期刊名稱、研究主題等線索組合起來。`,
  },
  {
    id: "q7",
    number: 7,
    level: "LEVEL 2｜組合搜尋線索",
    type: "accuracy",
    label: "🎯準確題",
    prompt: `如果目標是找剛才新聞說的「那篇研究」，
你會先試哪一個搜尋？`,
    options: [
      { key: "A", text: "青少年 睡眠" },
      { key: "B", text: "2025 Sleep Health 青少年 睡眠" },
      { key: "C", text: "研究證實睡眠不好" },
      { key: "D", text: "睡眠" },
    ],
    answer: "B",
    explanation: "不是因為 B 是唯一正確的搜尋法，而是它把幾個有辨識力的線索組在一起。",
  },
  {
    id: "q8",
    number: 8,
    level: "LEVEL 3｜確認研究身分",
    type: "accuracy",
    label: "🎯準確題",
    prompt: `搜尋後出現下面四種結果。

如果目標是追回新聞原本引用的研究，你最值得先打開哪一個？`,
    options: [
      { key: "A", text: "【新聞】\n滑手機真的會讓孩子睡不好嗎？最新研究告訴你……" },
      { key: "B", text: "【健康網站】\n青少年睡眠的五個重要提醒" },
      { key: "C", text: "【研究頁面】\n研究題名\n作者\n2025\nSleep Health\nAbstract" },
      { key: "D", text: "【AI摘要】\n根據研究，青少年螢幕使用可能與睡眠有關……" },
    ],
    answer: "C",
    explanation: "不是因為 C 看起來比較學術，而是它提供了可以確認研究身分的資訊。",
  },
  {
    id: "q9",
    number: 9,
    level: "LEVEL 3｜確認是不是那篇研究",
    type: "accuracy",
    label: "🎯準確題",
    prompt: `你點進一個頁面，上面有：

英文研究題名
作者
期刊
Abstract

但是：

研究內容談的是「大學生」，
新聞原本說的是「青少年」。

你現在應該怎麼做？`,
    options: [
      { key: "A", text: "有 Abstract 就算找到了" },
      { key: "B", text: "期刊一樣就算找到了" },
      { key: "C", text: "還要確認它是不是新聞原本說的那篇研究" },
      { key: "D", text: "英文看不懂，所以放棄" },
    ],
    answer: "C",
    explanation: "找到「一篇研究」還不夠，要確認是不是「那篇研究」。",
  },
];

export const ACTIVE_QUESTION_INDEX = 0;
export const ACTIVE_QUESTION = QUESTIONS[ACTIVE_QUESTION_INDEX];
export const SESSION_ID = "tomorrow-class";
