/**
 * Score Engine — Pure functions for computing progress scores and momentum.
 * These exact same formulas are replicated in the frontend for instant preview.
 */

/**
 * Compute progress score for a quarterly achievement.
 * Returns a number between 0.0 and capped at 1.5 (overachievement allowed).
 *
 * @param {'MIN'|'MAX'|'TIMELINE'|'ZERO'} uomType
 * @param {number|null} actualValue
 * @param {number|null} targetValue
 * @param {Date|string|null} actualDate
 * @param {Date|string|null} targetDate
 * @returns {number} score (0.0 – 1.5)
 */
function computeProgressScore({ uomType, actualValue, targetValue, actualDate, targetDate }) {
  switch (uomType) {
    case 'MIN': {
      // Higher actual = better. Score = actual / target
      if (!targetValue || targetValue === 0) return 0;
      return Math.min(Number(actualValue) / Number(targetValue), 1.5);
    }
    case 'MAX': {
      // Lower actual = better. Score = target / actual
      if (!actualValue || Number(actualValue) === 0) return 0;
      return Math.min(Number(targetValue) / Number(actualValue), 1.5);
    }
    case 'ZERO': {
      // Zero is the target. Score = 1 if actual === 0, else 0
      return Number(actualValue) === 0 ? 1.0 : 0.0;
    }
    case 'TIMELINE': {
      // Finish by target_date. Score = 1 if on time, penalized per day late
      if (!actualDate || !targetDate) return 0;
      const actual = new Date(actualDate);
      const target = new Date(targetDate);
      if (actual <= target) return 1.0;
      const daysLate = (actual - target) / (1000 * 60 * 60 * 24);
      return Math.max(0, 1 - daysLate / 30);
    }
    default:
      return 0;
  }
}

/**
 * Compute momentum flag by comparing current vs previous quarter scores.
 *
 * @param {number} currentScore
 * @param {number|null} previousScore
 * @returns {'ACCELERATING'|'STABLE'|'DECELERATING'}
 */
function computeMomentum(currentScore, previousScore) {
  if (previousScore === null || previousScore === undefined) return 'STABLE';
  const delta = currentScore - previousScore;
  if (delta > 0.10) return 'ACCELERATING';
  if (delta < -0.10) return 'DECELERATING';
  return 'STABLE';
}

module.exports = { computeProgressScore, computeMomentum };
