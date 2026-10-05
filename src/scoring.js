export function timestampToMillis(value) {
  if (value == null) return Number.POSITIVE_INFINITY;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1_000_000);
  return Number.POSITIVE_INFINITY;
}

function uniqueSelection(answer) {
  return Array.isArray(answer) ? [...new Set(answer)] : [];
}

export function isAnswerCorrect(question, answer) {
  if (!question || question.type === "open") return false;
  if (question.type !== "multi") return answer === question.answer;

  const selected = uniqueSelection(answer);
  const allowedKeys = question.scoring?.requiredKeys || [];
  const forbiddenKeys = question.scoring?.forbiddenKeys || [];
  const selectedGoodCount = selected.filter((key) => allowedKeys.includes(key)).length;
  const hasForbiddenKey = selected.some((key) => forbiddenKeys.includes(key));
  return selectedGoodCount >= (question.scoring?.minSelections || 0)
    && !hasForbiddenKey
    && selected.every((key) => allowedKeys.includes(key));
}

export function calculateQuestionScores(question, submissions) {
  const basePoints = question.type === "open" ? 0 : 1;
  const rows = submissions.map((submission) => ({
    ...submission,
    correct: isAnswerCorrect(question, submission.answer),
    baseScore: isAnswerCorrect(question, submission.answer) ? basePoints : 0,
    speedBonus: 0,
    totalPoints: isAnswerCorrect(question, submission.answer) ? basePoints : 0,
  }));

  if (question.type === "speed") {
    rows
      .filter((row) => row.correct)
      .sort((left, right) => timestampToMillis(left.submittedAt) - timestampToMillis(right.submittedAt) || left.teamId.localeCompare(right.teamId))
      .slice(0, 3)
      .forEach((row) => {
        row.speedBonus = 1;
        row.totalPoints += 1;
      });
  }
  return rows;
}

export function buildLeaderboard(teams) {
  return [...teams]
    .sort((left, right) => (right.score || 0) - (left.score || 0) || String(left.teamName || "").localeCompare(String(right.teamName || "")) || left.teamId.localeCompare(right.teamId))
    .map((team, index) => ({
      rank: index + 1,
      teamId: team.teamId,
      teamName: team.teamName,
      score: team.score || 0,
    }));
}

export function finalizeScoreSnapshot({ session, teams, question }) {
  if (session.scoringFinalized?.[question.id]) return { alreadyFinalized: true, teamUpdates: [], leaderboard: [] };

  const submissions = teams.map((team) => ({
    teamId: team.id,
    teamName: team.teamName,
    answer: team.answers?.[question.id]?.value,
    submittedAt: team.answers?.[question.id]?.submittedAt,
  }));
  const scoredRows = calculateQuestionScores(question, submissions);
  const teamUpdates = scoredRows.map((row) => ({
    teamId: row.teamId,
    teamName: row.teamName,
    score: (teams.find((team) => team.id === row.teamId)?.score || 0) + row.totalPoints,
    scoring: {
      correct: row.correct,
      baseScore: row.baseScore,
      speedBonus: row.speedBonus,
      totalPoints: row.totalPoints,
    },
  }));
  return {
    alreadyFinalized: false,
    teamUpdates,
    leaderboard: buildLeaderboard(teamUpdates),
  };
}
