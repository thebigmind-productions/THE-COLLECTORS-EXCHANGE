export const formatViewCount = (count) => {
  if (!Number.isFinite(Number(count)) || count <= 0) return null;
  if (count >= 1000000) {
    const m = count / 1000000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1000) {
    const k = count / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
};
