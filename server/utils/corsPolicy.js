const LOCAL_DEV_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

const parseCorsOrigins = (str) =>
  (str || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function isOriginAllowed(origin, {
  frontendOrigin,
  corsOrigins,
  isProd,
  allowLocalDevCors,
} = {}) {
  if (!origin) return true;

  const allowLocal = !isProd || allowLocalDevCors;
  if (allowLocal && LOCAL_DEV_ORIGIN.test(origin)) {
    return true;
  }

  const allowlist = new Set(
    [frontendOrigin, ...parseCorsOrigins(corsOrigins)].filter(Boolean)
  );

  return allowlist.has(origin);
}

function createCorsOriginChecker(config) {
  return (origin, callback) => {
    callback(null, isOriginAllowed(origin, config));
  };
}

module.exports = {
  LOCAL_DEV_ORIGIN,
  parseCorsOrigins,
  isOriginAllowed,
  createCorsOriginChecker,
};
