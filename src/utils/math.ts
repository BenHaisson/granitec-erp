/** Returns completion percentage, clamped to 0 when total is 0 */
export function pct(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
