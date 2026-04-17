#!/usr/bin/env bash
# ================================================================
# deploy.sh — Full production deployment for studyflow.uz
# Server: Ubuntu 22.04 | Domain: studyflow.uz, www.studyflow.uz
#
# Usage:  bash deploy.sh
# Idempotent: safe to run multiple times.
# ================================================================
set -euo pipefail
IFS=$'\n\t'

# ── Colours ──────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
die()     { error "$*"; exit 1; }

# ── Config ───────────────────────────────────────────────────────
DOMAIN="studyflow.uz"
WWW_DOMAIN="www.studyflow.uz"
EMAIL="admin@studyflow.uz"
DEPLOY_DIR="/opt/studyflow"
CERT_DIR="${DEPLOY_DIR}/nginx/certs"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Require root ─────────────────────────────────────────────────
[[ "$EUID" -eq 0 ]] || die "Run as root: sudo bash deploy.sh"

# ── Results tracker ──────────────────────────────────────────────
declare -A RESULTS

# ================================================================
# STEP 1 — Server bootstrap
# ================================================================
step1_bootstrap() {
    info "=== STEP 1: Server Bootstrap ==="

    info "Updating system packages..."
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

    info "Installing required packages..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        docker.io \
        docker-compose \
        git \
        curl \
        wget \
        certbot \
        ufw \
        fail2ban \
        unzip \
        htop

    info "Enabling Docker..."
    systemctl enable --now docker

    info "Configuring UFW firewall..."
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp   comment "SSH"
    ufw allow 80/tcp   comment "HTTP"
    ufw allow 443/tcp  comment "HTTPS"
    # Explicitly block PostgreSQL from external access
    ufw deny 5432/tcp  comment "Block PostgreSQL external"
    ufw deny 8000/tcp  comment "Block FastAPI direct external"
    ufw --force enable

    info "Configuring fail2ban..."
    systemctl enable --now fail2ban

    success "Bootstrap complete."
}

# ================================================================
# STEP 2 — SSL certificate
# ================================================================
step2_ssl() {
    info "=== STEP 2: SSL Certificate ==="

    mkdir -p "$CERT_DIR"

    if [[ -f "$CERT_DIR/fullchain.pem" && -f "$CERT_DIR/privkey.pem" ]]; then
        warn "Certificates already exist in $CERT_DIR — skipping certbot."
        warn "Run 'make ssl-renew' to force renewal."
        RESULTS["ssl"]="SKIP (already exists)"
        return 0
    fi

    info "Stopping any process on port 80..."
    # Stop docker containers that may be using port 80
    if command -v docker-compose &>/dev/null && [[ -f "${DEPLOY_DIR}/docker-compose.yml" ]]; then
        (cd "$DEPLOY_DIR" && docker-compose stop nginx 2>/dev/null || true)
    fi
    # Kill any other process on port 80
    fuser -k 80/tcp 2>/dev/null || true
    sleep 2

    info "Requesting Let's Encrypt certificate for ${DOMAIN} and ${WWW_DOMAIN}..."
    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN" \
        -d "$WWW_DOMAIN" \
        || die "certbot failed — check DNS records point to this server and port 80 is reachable."

    info "Copying certificates to $CERT_DIR..."
    cp -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "$CERT_DIR/fullchain.pem"
    cp -f "/etc/letsencrypt/live/${DOMAIN}/privkey.pem"   "$CERT_DIR/privkey.pem"
    chmod 600 "$CERT_DIR/privkey.pem"

    info "Setting up SSL auto-renewal cron..."
    CRON_RENEWAL="0 3 * * * certbot renew --quiet --deploy-hook 'cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${CERT_DIR}/fullchain.pem && cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ${CERT_DIR}/privkey.pem && chmod 600 ${CERT_DIR}/privkey.pem && cd ${DEPLOY_DIR} && docker-compose exec -T nginx nginx -s reload'"
    (crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_RENEWAL") | crontab -

    success "SSL certificate installed and auto-renewal configured."
    RESULTS["ssl"]="PASS"
}

# ================================================================
# STEP 3 — App deployment
# ================================================================
step3_deploy() {
    info "=== STEP 3: App Deployment ==="

    info "Creating deploy directory: $DEPLOY_DIR"
    mkdir -p "$DEPLOY_DIR"

    info "Copying project files to $DEPLOY_DIR..."
    rsync -av --exclude='.git' \
              --exclude='venv' \
              --exclude='__pycache__' \
              --exclude='*.pyc' \
              --exclude='.env' \
              --exclude='backups' \
              "${SCRIPT_DIR}/" \
              "${DEPLOY_DIR}/"

    cd "$DEPLOY_DIR"

    # ── Create .env interactively if it doesn't exist ─────────
    if [[ ! -f "${DEPLOY_DIR}/.env" ]]; then
        info "No .env file found. Let's create one interactively."
        echo ""
        echo "────────────────────────────────────────────────────"
        echo "  Enter production environment values below."
        echo "  Press Enter to accept [defaults in brackets]."
        echo "────────────────────────────────────────────────────"
        echo ""

        read -r -p "DB_PASSWORD (strong random password): " DB_PASSWORD
        [[ -z "$DB_PASSWORD" ]] && die "DB_PASSWORD cannot be empty."

        read -r -p "JWT_SECRET (min 64 chars, or press Enter to auto-generate): " JWT_SECRET
        if [[ -z "$JWT_SECRET" ]]; then
            JWT_SECRET=$(openssl rand -hex 32)
            info "Auto-generated JWT_SECRET: ${JWT_SECRET}"
        fi

        read -r -p "ALLOWED_ORIGINS [https://${DOMAIN},https://${WWW_DOMAIN}]: " ALLOWED_ORIGINS
        ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://${DOMAIN},https://${WWW_DOMAIN}}"

        read -r -p "TELEGRAM_BOT_TOKEN [leave blank to skip]: " TELEGRAM_BOT_TOKEN
        TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"

        read -r -p "TELEGRAM_WEBHOOK_SECRET [leave blank to skip]: " TELEGRAM_WEBHOOK_SECRET
        TELEGRAM_WEBHOOK_SECRET="${TELEGRAM_WEBHOOK_SECRET:-}"

        read -r -p "SENTRY_DSN [leave blank to skip]: " SENTRY_DSN
        SENTRY_DSN="${SENTRY_DSN:-}"

        cat > "${DEPLOY_DIR}/.env" <<EOF
# Generated by deploy.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
APP_ENV=production
APP_HOST=0.0.0.0
APP_PORT=8000
APP_DEBUG=false

DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgresql+asyncpg://postgres:${DB_PASSWORD}@db:5432/educrm
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

JWT_SECRET=${JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_ACCESS_EXPIRE_MINUTES=60
JWT_REFRESH_EXPIRE_DAYS=30

ALLOWED_ORIGINS=${ALLOWED_ORIGINS}

TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_WEBHOOK_SECRET=${TELEGRAM_WEBHOOK_SECRET}

SENTRY_DSN=${SENTRY_DSN}

RATE_LIMIT_PER_MINUTE=120
EOF
        chmod 600 "${DEPLOY_DIR}/.env"
        success ".env created."
    else
        warn ".env already exists — skipping interactive setup."
        # Export DB_PASSWORD so docker-compose can read it
        set -a; source "${DEPLOY_DIR}/.env"; set +a
    fi

    # Re-source to get DB_PASSWORD for docker-compose
    set -a; source "${DEPLOY_DIR}/.env"; set +a

    # Ensure certs are in place
    if [[ ! -f "${CERT_DIR}/fullchain.pem" ]]; then
        die "SSL certificates not found in ${CERT_DIR}. Run step2_ssl first."
    fi

    info "Building and starting containers..."
    docker-compose up -d --build

    info "Waiting for all containers to become healthy (up to 120s)..."
    local timeout=120
    local elapsed=0
    while true; do
        UNHEALTHY=$(docker-compose ps --format json 2>/dev/null \
            | python3 -c "
import sys, json
data = sys.stdin.read()
unhealthy = []
for line in data.strip().split('\n'):
    if not line.strip(): continue
    try:
        svc = json.loads(line)
        state = svc.get('Health', svc.get('State', ''))
        if state not in ('healthy', 'running', ''):
            unhealthy.append(svc.get('Service', svc.get('Name', '?')))
    except: pass
print('\n'.join(unhealthy))
" 2>/dev/null || echo "")

        if [[ -z "$UNHEALTHY" ]]; then
            success "All containers are up and healthy."
            break
        fi

        if [[ $elapsed -ge $timeout ]]; then
            error "Timed out waiting for healthy containers."
            docker-compose ps
            docker-compose logs --tail=30
            die "Deployment failed — containers not healthy after ${timeout}s."
        fi

        info "Waiting... (${elapsed}s elapsed, not yet healthy: ${UNHEALTHY})"
        sleep 5
        elapsed=$((elapsed + 5))
    done

    info "Container status:"
    docker-compose ps

    success "App deployed."
}

# ================================================================
# STEP 4 — Post-deploy verification
# ================================================================
step4_verify() {
    info "=== STEP 4: Post-Deploy Verification ==="
    echo ""

    local pass=0
    local fail=0

    check() {
        local label="$1"
        local url="$2"
        local expected="${3:-200}"

        info "Checking: ${label} → ${url}"
        local http_code
        http_code=$(curl -sSkL -o /dev/null -w "%{http_code}" \
            --max-time 15 \
            --retry 3 \
            --retry-delay 3 \
            "$url" 2>/dev/null || echo "000")

        if [[ "$http_code" == "$expected" ]]; then
            success "${label}: HTTP ${http_code} ✓"
            RESULTS["$label"]="PASS (HTTP ${http_code})"
            ((pass++)) || true
        else
            error "${label}: HTTP ${http_code} (expected ${expected}) ✗"
            RESULTS["$label"]="FAIL (HTTP ${http_code}, expected ${expected})"
            ((fail++)) || true
        fi
    }

    sleep 5  # Give nginx a moment after startup

    check "HTTPS health"    "https://${DOMAIN}/health"    "200"
    check "HTTPS homepage"  "https://${DOMAIN}/"          "404"
    check "HTTP→HTTPS redir" "http://${DOMAIN}/"          "301"
    check "WWW redirect"    "https://${WWW_DOMAIN}/health" "200"

    info "API logs (last 30 lines):"
    docker-compose logs --tail=30 api

    echo ""
    echo "════════════════════════════════════════════════════"
    echo "  DEPLOYMENT SUMMARY"
    echo "════════════════════════════════════════════════════"
    for key in "${!RESULTS[@]}"; do
        local val="${RESULTS[$key]}"
        if [[ "$val" == PASS* ]]; then
            echo -e "  ${GREEN}PASS${NC}  ${key}: ${val}"
        elif [[ "$val" == FAIL* ]]; then
            echo -e "  ${RED}FAIL${NC}  ${key}: ${val}"
        else
            echo -e "  ${YELLOW}SKIP${NC}  ${key}: ${val}"
        fi
    done
    echo "════════════════════════════════════════════════════"

    if [[ $fail -gt 0 ]]; then
        error "${fail} check(s) failed. Review logs above."
        exit 1
    else
        success "All ${pass} checks passed!"
        echo ""
        echo -e "  ${GREEN}★ studyflow.uz is live at https://${DOMAIN}${NC}"
        echo ""
    fi
}

# ================================================================
# MAIN
# ================================================================
main() {
    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║   StudyFlow.uz — Production Deployment              ║"
    echo "║   Domain: ${DOMAIN}                        ║"
    echo "║   Dir:    ${DEPLOY_DIR}                      ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo ""

    step1_bootstrap
    step2_ssl
    step3_deploy
    step4_verify
}

main "$@"