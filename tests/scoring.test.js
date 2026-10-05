import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { QUESTIONS } from "../src/questions.js";
import { buildLeaderboard, calculateQuestionScores, finalizeScoreSnapshot } from "../src/scoring.js";

const question = (number) => QUESTIONS.find((item) => item.number === number);

// TEST 1: Q1 only the first three correct submissions receive the speed bonus.
const q1Rows = calculateQuestionScores(question(1), [
  { teamId: "a", teamName: "Team A", answer: "A", submittedAt: 1 },
  { teamId: "b", teamName: "Team B", answer: "B", submittedAt: 2 },
  { teamId: "c", teamName: "Team C", answer: "A", submittedAt: 3 },
  { teamId: "d", teamName: "Team D", answer: "B", submittedAt: 4 },
  { teamId: "e", teamName: "Team E", answer: "B", submittedAt: 5 },
]);
assert.deepEqual(Object.fromEntries(q1Rows.map((row) => [row.teamId, row.totalPoints])), { a: 0, b: 2, c: 0, d: 2, e: 2 });
assert.deepEqual(q1Rows.filter((row) => row.speedBonus === 1).map((row) => row.teamId), ["b", "d", "e"]);

// TEST 2: Q5 accepts any three good keys and rejects E, regardless of order.
const q5 = question(5);
const q5Score = (answer) => calculateQuestionScores(q5, [{ teamId: "team", teamName: "Team", answer, submittedAt: 1 }])[0].totalPoints;
assert.deepEqual({
  ABC: q5Score(["A", "B", "C"]),
  ABD: q5Score(["A", "B", "D"]),
  ACD: q5Score(["A", "C", "D"]),
  BCD: q5Score(["B", "C", "D"]),
  ABCD: q5Score(["A", "B", "C", "D"]),
  CBA: q5Score(["C", "B", "A"]),
  DAC: q5Score(["D", "A", "C"]),
  DCBA: q5Score(["D", "C", "B", "A"]),
  AB: q5Score(["A", "B"]),
  AE: q5Score(["A", "E"]),
  ABCE: q5Score(["A", "B", "C", "E"]),
  ABCDE: q5Score(["A", "B", "C", "D", "E"]),
  E: q5Score(["E"]),
}, {
  ABC: 1, ABD: 1, ACD: 1, BCD: 1, ABCD: 1,
  CBA: 1, DAC: 1, DCBA: 1,
  AB: 0, AE: 0, ABCE: 0, ABCDE: 0, E: 0,
});

// TEST 3: Q6 never awards points.
assert.equal(calculateQuestionScores(question(6), [{ teamId: "team", teamName: "Team", answer: "any search text", submittedAt: 1 }])[0].totalPoints, 0);

// TEST 4: Finalizing the same question twice is idempotent.
const q2 = question(2);
const firstFinalize = finalizeScoreSnapshot({
  session: { scoringFinalized: {} },
  teams: [{ id: "a", teamName: "Team A", score: 0, answers: { q2: { value: "C", submittedAt: 1 } } }],
  question: q2,
});
const secondFinalize = finalizeScoreSnapshot({
  session: { scoringFinalized: { q2: true } },
  teams: [{ id: "a", teamName: "Team A", score: firstFinalize.teamUpdates[0].score, answers: { q2: { value: "C", submittedAt: 1 } } }],
  question: q2,
});
assert.equal(firstFinalize.teamUpdates[0].score, 1);
assert.equal(secondFinalize.alreadyFinalized, true);
assert.deepEqual(secondFinalize.teamUpdates, []);

// TEST 5: Re-running the finalized snapshot (the refresh/retry case) cannot add points.
assert.equal(finalizeScoreSnapshot({
  session: { scoringFinalized: { q2: true } },
  teams: [{ id: "a", teamName: "Team A", score: 1, answers: { q2: { value: "C", submittedAt: 1 } } }],
  question: q2,
}).teamUpdates.length, 0);

// TEST 6: A perfect Q1-Q9 run totals exactly 10 points.
let total = 0;
for (const number of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const item = question(number);
  const answer = item.type === "multi" ? ["A", "B", "C"] : item.answer;
  const result = finalizeScoreSnapshot({
    session: { scoringFinalized: {} },
    teams: [{ id: "perfect", teamName: "Perfect Team", score: total, answers: { [item.id]: { value: answer, submittedAt: number } } }],
    question: item,
  });
  total = result.teamUpdates[0].score;
}
assert.equal(total, 10);

// Leaderboard ties are score-first and stable by team name, never by speed.
assert.deepEqual(buildLeaderboard([
  { teamId: "z", teamName: "研究隊", score: 7 },
  { teamId: "a", teamName: "火箭隊", score: 8 },
  { teamId: "b", teamName: "牛頓隊", score: 7 },
]).map((row) => `${row.rank}:${row.teamName}:${row.score}`), ["1:火箭隊:8", "2:牛頓隊:7", "3:研究隊:7"]);

const firebaseSource = readFileSync(new URL("../src/firebase.js", import.meta.url), "utf8");
assert.match(firebaseSource, /scoringFinalized/);
assert.match(firebaseSource, /leaderboard/);
assert.match(firebaseSource, /leaderboard\.docs\.forEach/);
assert.match(firebaseSource, /scoringFinalized: \{\}/);
assert.match(firebaseSource, /leaderboardVisible: false/);
assert.match(firebaseSource, /currentView: "waiting"/);

console.log("scoring tests: 6 passed");
