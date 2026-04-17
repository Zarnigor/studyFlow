# ================================================================
# Makefile — StudyFlow.uz production management
# ================================================================

SERVER_IP  := 204.168.168.250
SERVER_USER:= root
DEPLOY_DIR := /opt/studyflow
SSH_KEY    ?= ~/.ssh/id_ed25519
SSH        := ssh -i $(SSH_KEY) -o StrictHostKeyChecking=no $(SERVER_USER)@$(SERVER_IP)
SCP        := scp -i $(SSH_KEY) -o StrictHostKeyChecking=no

BACKUP_DIR := ./backups
TIMESTAMP  := $(shell date +%Y%m%d_%H%M%S)

.PHONY: deploy update logs restart stop backup restore ssl-renew ssh help

# ── Default ────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  StudyFlow.uz — Makefile targets"
	@echo "  ─────────────────────────────────────────"
	@echo "  make deploy    — Full bootstrap + deploy to server"
	@echo "  make update    — git pull + rebuild (zero-downtime)"
	@echo "  make logs      — Tail all container logs"
	@echo "  make restart   — Restart all containers"
	@echo "  make stop      — Stop all containers (docker-compose down)"
	@echo "  make backup    — Dump DB → timestamped .sql.gz in ./backups/"
	@echo "  make restore   — Restore from latest backup"
	@echo "  make ssl-renew — Renew SSL cert + reload nginx"
	@echo "  make ssh       — Open SSH session to server"
	@echo ""

# ── Deploy: rsync files then run deploy.sh on server ──────────
deploy:
	@echo "→ Syncing project to $(SERVER_USER)@$(SERVER_IP):$(DEPLOY_DIR)..."
	rsync -avz --progress \
		--exclude='.git' \
		--exclude='venv' \
		--exclude='__pycache__' \
		--exclude='*.pyc' \
		--exclude='.env' \
		--exclude='backups' \
		--exclude='*.egg-info' \
		./ \
		$(SERVER_USER)@$(SERVER_IP):$(DEPLOY_DIR)/
	@echo "→ Running deploy.sh on server..."
	$(SSH) "chmod +x $(DEPLOY_DIR)/deploy.sh && bash $(DEPLOY_DIR)/deploy.sh"

# ── Update: pull latest code and rebuild without downtime ─────
update:
	@echo "→ Pulling latest code on server..."
	$(SSH) "cd $(DEPLOY_DIR) && git pull --ff-only origin main && \
		docker-compose pull --quiet && \
		docker-compose up -d --build --remove-orphans && \
		docker-compose ps"

# ── Logs: tail all containers ─────────────────────────────────
logs:
	$(SSH) "cd $(DEPLOY_DIR) && docker-compose logs -f --tail=100"

# ── Restart: restart all containers ───────────────────────────
restart:
	$(SSH) "cd $(DEPLOY_DIR) && docker-compose restart && docker-compose ps"

# ── Stop: take everything down ────────────────────────────────
stop:
	$(SSH) "cd $(DEPLOY_DIR) && docker-compose down"

# ── Backup: pg_dump → gzipped sql ────────────────────────────
backup:
	@echo "→ Creating database backup..."
	@mkdir -p $(BACKUP_DIR)
	$(SSH) "cd $(DEPLOY_DIR) && docker-compose exec -T db \
		pg_dump -U postgres educrm" \
		| gzip > $(BACKUP_DIR)/educrm_$(TIMESTAMP).sql.gz
	@echo "✓ Backup saved: $(BACKUP_DIR)/educrm_$(TIMESTAMP).sql.gz"
	@ls -lh $(BACKUP_DIR)/educrm_*.sql.gz | tail -5

# ── Restore: restore from latest local backup ─────────────────
restore:
	$(eval LATEST := $(shell ls -t $(BACKUP_DIR)/educrm_*.sql.gz 2>/dev/null | head -1))
	@if [ -z "$(LATEST)" ]; then \
		echo "ERROR: No backup files found in $(BACKUP_DIR)/"; exit 1; \
	fi
	@echo "→ Restoring from: $(LATEST)"
	@read -p "This will OVERWRITE the production database. Continue? [y/N] " confirm; \
		[ "$$confirm" = "y" ] || { echo "Aborted."; exit 1; }
	zcat $(LATEST) | $(SSH) "cd $(DEPLOY_DIR) && \
		docker-compose exec -T db psql -U postgres -d educrm"
	@echo "✓ Restore complete."

# ── SSL renewal ───────────────────────────────────────────────
ssl-renew:
	$(SSH) "certbot renew --quiet && \
		cp /etc/letsencrypt/live/studyflow.uz/fullchain.pem $(DEPLOY_DIR)/nginx/certs/fullchain.pem && \
		cp /etc/letsencrypt/live/studyflow.uz/privkey.pem   $(DEPLOY_DIR)/nginx/certs/privkey.pem && \
		chmod 600 $(DEPLOY_DIR)/nginx/certs/privkey.pem && \
		cd $(DEPLOY_DIR) && docker-compose exec -T nginx nginx -s reload && \
		echo 'SSL renewed and nginx reloaded.'"

# ── SSH: open interactive session ────────────────────────────
ssh:
	$(SSH)