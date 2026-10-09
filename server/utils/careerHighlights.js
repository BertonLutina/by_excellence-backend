const { coercePortfolioImages, bindJsonDocument, PortfolioImagesParseError } = require('./portfolioImages');

const MAX_CAREER_ITEMS = 20;

function normalizeCareerHighlight(item, index) {
  if (!item || typeof item !== 'object') return null;
  const title = String(item.title || '').trim().slice(0, 160);
  if (!title) return null;
  return {
    id: String(item.id || `career-${index + 1}`).slice(0, 64),
    title,
    year: String(item.year || '').trim().slice(0, 12),
    place: String(item.place || '').trim().slice(0, 120),
    description: String(item.description || '').trim().slice(0, 400),
  };
}

function coerceCareerHighlights(value) {
  if (value === undefined) return undefined;
  const parsed = coercePortfolioImages(value);
  if (parsed == null) return [];
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeCareerHighlight).filter(Boolean).slice(0, MAX_CAREER_ITEMS);
}

function bindCareerHighlights(value) {
  const normalized = coerceCareerHighlights(value);
  if (normalized === undefined) return undefined;
  return bindJsonDocument(normalized);
}

module.exports = {
  MAX_CAREER_ITEMS,
  coerceCareerHighlights,
  bindCareerHighlights,
  normalizeCareerHighlight,
  CareerHighlightsParseError: PortfolioImagesParseError,
};
