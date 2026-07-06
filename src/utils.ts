export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDuration(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "00:00";
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

export function getLyricIndex(progress: number, lyricCount: number) {
  if (lyricCount <= 0) {
    return 0;
  }
  const normalized = Math.max(0, Math.min(100, progress));
  return Math.min(lyricCount - 1, Math.floor((normalized / 100) * lyricCount));
}
