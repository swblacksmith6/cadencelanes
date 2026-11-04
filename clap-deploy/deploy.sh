#!/usr/bin/env bash
# Deploy to clap from a local checkout. Usage:
#   clap-deploy/deploy.sh <host> [cadencelanes|proxy|backup|monitor|pkndr ...]
# With no targets it deploys cadencelanes. Secrets (.env, auth files) are never synced.
# Needs: passwordless sudo for the deploy user on <host>, docker installed (server/harden.sh).
set -euo pipefail

HOST=${1:?usage: deploy.sh <host> [cadencelanes|proxy|backup|pkndr ...]}
shift || true
TARGETS=("${@:-cadencelanes}")

HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/.." && pwd)
PKNDR_SRC=${PKNDR_SRC:-$HOME/src/pkndr}

# One multiplexed SSH connection: the host rate-limits new SSH connections (ufw limit).
CTL=$(mktemp -u /tmp/clap-ssh.XXXXXX)
SSH_OPTS=(-o BatchMode=yes -o ControlMaster=auto -o ControlPath="$CTL" -o ControlPersist=2m)
rssh() { ssh "${SSH_OPTS[@]}" "deploy@$HOST" "$@"; }
rsy() { rsync -a -e "ssh ${SSH_OPTS[*]}" "$@"; }
trap 'ssh "${SSH_OPTS[@]}" -O exit "deploy@$HOST" 2>/dev/null || true' EXIT

for t in "${TARGETS[@]}"; do
    case "$t" in
    cadencelanes)
        # Requires /opt/apps/cadencelanes/.env on the host (JWT_SECRET, MSG91_*), see README.
        rssh 'test -f /opt/apps/cadencelanes/.env' || { echo "missing /opt/apps/cadencelanes/.env on $HOST" >&2; exit 1; }
        rsy --delete \
            --exclude .git --exclude .githooks --exclude .github --exclude .claude --exclude '.env*' \
            --exclude data --exclude docs --exclude clap-deploy --exclude '*.md' --exclude __pycache__ \
            --exclude node_modules --exclude dist --exclude .venv --exclude .pytest_cache \
            --exclude backend/tests --exclude run.sh --exclude run_tests.sh --exclude seed_demo.py \
            --exclude 'docker-compose.local-prod.yml' \
            "$REPO/" "deploy@$HOST:/opt/apps/cadencelanes/"
        rssh 'cd /opt/apps/cadencelanes && sudo docker compose -f docker-compose.prod.yml up -d --build'
        ;;
    proxy)
        # auth.caddy is optional (basic auth snippet) and lives only on the host.
        rsy --exclude auth.caddy --exclude '*credentials*' "$HERE/proxy/" "deploy@$HOST:/opt/proxy/"
        # Single-file bind mounts keep the old inode after rsync, so recreate instead of reload.
        rssh 'cd /opt/proxy && sudo docker compose up -d --force-recreate'
        ;;
    backup)
        rsy "$HERE/backup/clap-backup.sh" "$HERE/backup/clap-backup.cron" "deploy@$HOST:/tmp/"
        rssh 'sudo install -o root -g root -m 0750 /tmp/clap-backup.sh /usr/local/sbin/clap-backup.sh \
              && sudo install -o root -g root -m 0644 /tmp/clap-backup.cron /etc/cron.d/clap-backup \
              && rm /tmp/clap-backup.sh /tmp/clap-backup.cron'
        ;;
    monitor)
        rsy "$HERE/monitor/clap-monitor.sh" "$HERE/monitor/clap-monitor.cron" "deploy@$HOST:/tmp/"
        rssh 'sudo install -o root -g root -m 0750 /tmp/clap-monitor.sh /usr/local/sbin/clap-monitor.sh \
              && sudo install -o root -g root -m 0644 /tmp/clap-monitor.cron /etc/cron.d/clap-monitor \
              && rm /tmp/clap-monitor.sh /tmp/clap-monitor.cron \
              && sudo /usr/local/sbin/clap-monitor.sh && sudo cat /var/lib/clap-monitor/latest.json'
        ;;
    pkndr)
        # Needs /opt/apps/pkndr/.env on the host (PKNDR_* settings).
        rssh 'test -f /opt/apps/pkndr/.env' || { echo "missing /opt/apps/pkndr/.env on $HOST" >&2; exit 1; }
        rsy "$HERE/pkndr/" "deploy@$HOST:/opt/apps/pkndr/" --exclude src --exclude .env
        rsy --delete --exclude .git --exclude .claude --exclude node_modules --exclude dist \
            --exclude '.env*' --exclude '*.db' --exclude .venv --exclude __pycache__ --exclude '.*_cache' \
            --exclude tests "$PKNDR_SRC/" "deploy@$HOST:/opt/apps/pkndr/src/"
        rssh 'cd /opt/apps/pkndr && sudo docker compose up -d --build'
        ;;
    *)
        echo "unknown target: $t" >&2
        exit 2
        ;;
    esac
    echo "deployed: $t"
done
