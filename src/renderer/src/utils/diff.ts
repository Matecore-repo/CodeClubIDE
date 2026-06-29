export function computeDiffStats(
  original: string,
  modified: string,
): { additions: number; deletions: number } {
  // A simple line-by-line comparison heuristic to estimate additions and deletions.
  // Note: This is a fast approximation since Monaco will handle the actual visual diffing.
  // We just need a good enough estimate for the UI counter (+106 -0).
  const origLines = original.split("\n");
  const modLines = modified.split("\n");

  // Using a very simplified diff approach (LCS approximation)
  // For larger files, we don't want to block the thread, so we do a quick check.

  // If files are very large, just fallback to length difference to avoid freezing UI
  if (origLines.length > 5000 || modLines.length > 5000) {
    const diff = modLines.length - origLines.length;
    return {
      additions: diff > 0 ? diff : 0,
      deletions: diff < 0 ? -diff : 0,
    };
  }

  // Simplified Myers Diff / LCS for counting additions/deletions
  const N = origLines.length;
  const M = modLines.length;

  // Create an array to keep track of the longest common subsequence
  const dp = Array.from({ length: N + 1 }, () => new Int32Array(M + 1));

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      if (origLines[i - 1] === modLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcs = dp[N][M];
  return {
    deletions: N - lcs,
    additions: M - lcs,
  };
}
