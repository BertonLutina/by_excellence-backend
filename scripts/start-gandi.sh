#!/bin/sh
set -eu

# Gandi layout varies by plan:
#   - lamp0: app in /lamp0/web/vhosts/default, secrets in /private/env.sh (root)
#   - legacy:  /srv/data/web/vhosts/default/private/env.sh
# Override with GANDI_ENV_FILE if your host uses another path.

resolve_env_file() {
  if [ -n "${GANDI_ENV_FILE:-}" ] && [ -f "$GANDI_ENV_FILE" ]; then
    printf '%s' "$GANDI_ENV_FILE"
    return 0
  fi

  for candidate in \
    "/private/env.sh" \
    "/srv/data/web/vhosts/default/private/env.sh" \
    "/lamp0/private/env.sh" \
    "$(pwd)/.env" \
    "/lamp0/web/vhosts/default/.env" \
    "/srv/data/web/vhosts/default/.env"
  do
    if [ -f "$candidate" ]; then
      printf '%s' "$candidate"
      return 0
    fi
  done

  return 1
}

ENV_FILE=""
if ENV_FILE="$(resolve_env_file)"; then
  echo "[start] Loading env from: $ENV_FILE" >&2
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
elif [ -n "${GANDI:-}" ] || [ "${NODE_ENV:-}" = "production" ]; then
  echo "[start] Missing environment file. Tried:" >&2
  echo "[start]   GANDI_ENV_FILE (if set)" >&2
  echo "[start]   /private/env.sh" >&2
  echo "[start]   /srv/data/web/vhosts/default/private/env.sh" >&2
  echo "[start]   $(pwd)/.env" >&2
  echo "[start] Copy env.gandi.sh to /private/env.sh on Gandi (FTP: folder private at root)." >&2
  exit 1
fi

exec node server.js
