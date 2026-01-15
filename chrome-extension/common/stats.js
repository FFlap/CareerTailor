import { getUsageStats, setUsageStats } from "./storage.js";
import { getDayKey, getWeekKey } from "./utils.js";

export async function logGeminiUsage({
  success,
  rateLimited,
  promptTokens = 0,
  candidateTokens = 0,
  totalTokens = 0,
  errorMessage = ""
}) {
  const stats = await getUsageStats();
  stats.total_calls += 1;
  if (success) {
    stats.success_calls += 1;
  } else {
    stats.error_calls += 1;
  }
  if (rateLimited) {
    stats.rate_limit_errors += 1;
  }
  stats.token_prompt += promptTokens;
  stats.token_candidates += candidateTokens;
  stats.token_total += totalTokens;

  const dayKey = getDayKey();
  const weekKey = getWeekKey();
  stats.daily[dayKey] = (stats.daily[dayKey] || 0) + 1;
  stats.weekly[weekKey] = (stats.weekly[weekKey] || 0) + 1;

  if (errorMessage) {
    stats.last_errors.unshift({
      message: errorMessage,
      timestamp: Date.now()
    });
    stats.last_errors = stats.last_errors.slice(0, 20);
  }

  await setUsageStats(stats);
  return stats;
}
