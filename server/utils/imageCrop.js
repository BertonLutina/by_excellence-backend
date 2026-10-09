function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeImageCrop(value) {
  if (value == null || value === '') return { ok: true, value: null };
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { ok: false };
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false };
  const x = toNumber(raw.x);
  const y = toNumber(raw.y);
  const w = toNumber(raw.w);
  const h = toNumber(raw.h);
  if ([x, y, w, h].some((n) => n == null)) return { ok: false };
  if (x < 0 || y < 0 || w <= 0 || h <= 0) return { ok: false };
  if (x + w > 1.01 || y + h > 1.01) return { ok: false };
  const round = (n) => Math.round(n * 10000) / 10000;
  return { ok: true, value: { x: round(x), y: round(y), w: round(w), h: round(h) } };
}

function parseStoredImageCrop(value) {
  const parsed = normalizeImageCrop(value);
  return parsed.ok ? parsed.value : null;
}

module.exports = { normalizeImageCrop, parseStoredImageCrop };
