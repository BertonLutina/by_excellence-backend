#!/bin/sh
# Gandi production template — copy to:
#   /private/env.sh          (lamp0: private folder at FTP root)
#   OR /srv/data/web/vhosts/default/private/env.sh  (legacy layout)

export NODE_ENV=production
export LOG_LEVEL=error

# Gandi injects PORT automatically — do not set PORT unless support asks you to.
export GANDI="byexcellence-as.com"
export WEB_MEMORY=128
export WEB_CONCURRENCY=2

export APP_URL="https://byexcellence-as.com"
export API_BASE_URL="https://byexcellence-as.com"
export FRONTEND_ORIGIN="https://byexcellence-as.com"
export CORS_ORIGINS="https://byexcellence-as.com,https://www.byexcellence-as.com"
export ALLOW_LOCAL_DEV_CORS=false

export DB_SOCKET_PATH="/srv/run/mysqld/mysqld.sock"
export DB_USER="root"
export DB_PASSWORD=""
export DB_NAME="by_excellence"

export JWT_SECRET="CHANGE_ME_WITH_A_LONG_RANDOM_SECRET_AT_LEAST_32_CHARS"
export JWT_EXPIRES_IN="7d"

export SMTP_HOST="mail.gandi.net"
export SMTP_PORT=587
export SMTP_SECURE=false
export SMTP_USER="info@byexcellence-as.com"
export SMTP_PASS="CHANGE_ME"
export SMTP_FROM="By Excellence <info@byexcellence-as.com>"
export CONTACT_INBOX_EMAIL="info@byexcellence-as.com"

export UPLOAD_DRIVER="local"
export UPLOAD_DIR="/lamp0/web/vhosts/default/uploads"
export MAX_UPLOAD_MB=10
export UPLOAD_RATE_LIMIT_WINDOW_MS=900000
export UPLOAD_RATE_LIMIT_MAX=60

export COMMISSION_STANDARD_PERCENT=15
export COMMISSION_PREMIUM_DEFAULT_PERCENT=20

export STRIPE_SECRET_KEY="sk_test_CHANGE_ME"
export STRIPE_WEBHOOK_SECRET="whsec_CHANGE_ME"
# Separate destination/secret for Connect ("Comptes connectés") events — see .env.example.
export STRIPE_CONNECT_WEBHOOK_SECRET="whsec_CHANGE_ME"
export STRIPE_BYPASS=false
