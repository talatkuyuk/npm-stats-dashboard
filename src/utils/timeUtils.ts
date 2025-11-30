// Helper function to format time until rate limit reset
export function formatTimeUntilReset(resetTime: number): string {
  const now = Date.now();
  const diff = resetTime - now;

  if (diff <= 0) return "now";

  const minutes = Math.ceil(diff / (60 * 1000));
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;

  const hours = Math.ceil(diff / (60 * 60 * 1000));
  return `${hours} hour${hours !== 1 ? "s" : ""}`;
}
