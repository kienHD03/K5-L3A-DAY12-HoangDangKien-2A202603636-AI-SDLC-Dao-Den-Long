/**
 * Pure local leaderboard validation, sorting, and top-10 retention logic.
 */

const NAME_RE = /^[\p{L}\p{N}_]{3,12}$/u;

export function isValidLeaderboardName(name) {
  return typeof name === 'string' && NAME_RE.test(name.trim());
}

export function sortLeaderboard(entries) {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ta = Date.parse(a.achieved_at) || 0;
    const tb = Date.parse(b.achieved_at) || 0;
    return ta - tb;
  });
}

export function addLeaderboardEntry(existingEntries, entry) {
  const cleanName = String(entry.name || '').trim();
  if (!isValidLeaderboardName(cleanName)) {
    throw new Error('Tên phải dài 3–12 ký tự (chữ cái, số hoặc dấu gạch dưới _).');
  }
  const normalized = {
    name: cleanName,
    score: Math.max(0, Math.floor(Number(entry.score) || 0)),
    nights_won: Math.max(0, Math.min(3, Math.floor(Number(entry.nights_won) || 0))),
    achieved_at: entry.achieved_at || new Date().toISOString(),
    seed: Number.isInteger(entry.seed) ? entry.seed : 0,
  };
  return sortLeaderboard([...(existingEntries || []), normalized]).slice(0, 10);
}
