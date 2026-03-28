class PortfolioImagesParseError extends Error {
  constructor() {
    super('portfolio_images must be valid JSON');
    this.name = 'PortfolioImagesParseError';
  }
}

/**
 * Parses string payloads (e.g. multipart) so we work with real arrays/objects before binding.
 */
function coercePortfolioImages(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      throw new PortfolioImagesParseError();
    }
  }
  return value;
}

/**
 * mysql2 + MariaDB: binding JS arrays/objects to JSON columns can error (ER_WRONG_ARGUMENTS).
 * Pass JSON text; the server stores a proper JSON document (ARRAY/OBJECT), not a quoted string.
 */
function bindJsonDocument(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return value;
}

module.exports = {
  coercePortfolioImages,
  bindJsonDocument,
  PortfolioImagesParseError,
};
