#!/usr/bin/env bash
# Run on the monitoring machine (the MacBook Air). Pulls clap's stats folder into a local archive.
# Read-only: the key it uses is restricted on clap to `rrsync -ro /var/lib/clap-monitor`.
#
#   ~/bin/pull-clap-stats.sh            # normally run from cron every 10 minutes
#
# Results in $DEST:
#   stats-YYYY-MM-DD.csv, containers-YYYY-MM-DD.csv   full history, never pruned here
#   latest.json                                        newest sample from clap
#   pull-status.json                                   outcome of the last pull (for the alerter)
#   pull.log                                           short log, trimmed automatically
set -uo pipefail

CLAP_HOST=${CLAP_HOST:-clap}
CLAP_USER=${CLAP_USER:-deploy}
KEY=${CLAP_KEY:-$HOME/.ssh/clap_monitor_ed25519}
DEST=${CLAP_DEST:-$HOME/clap-stats}
STALE_S=${CLAP_STALE_S:-900}          # latest.json older than this means clap stopped sampling

mkdir -p "$DEST"
exec 9>"$DEST/.pull.lock"
flock -n 9 || exit 0

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
status() {  # ok, message
    printf '{"pulled_at":"%s","ok":%s,"latest_age_s":%s,"message":"%s"}\n' \
        "$NOW" "$1" "${LATEST_AGE:--1}" "$2" > "$DEST/pull-status.json.tmp"
    mv -f "$DEST/pull-status.json.tmp" "$DEST/pull-status.json"
    echo "$NOW ok=$1 age=${LATEST_AGE:--1} $2" >> "$DEST/pull.log"
    tail -n 2000 "$DEST/pull.log" > "$DEST/pull.log.tmp" && mv -f "$DEST/pull.log.tmp" "$DEST/pull.log"
}

# The remote path is relative to the rrsync root, so "./" is /var/lib/clap-monitor.
if ! OUT=$(rsync -a --partial --timeout=60 --exclude '.*' \
        -e "ssh -i $KEY -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes" \
        "$CLAP_USER@$CLAP_HOST:./" "$DEST/" 2>&1); then
    status false "rsync failed: $(echo "$OUT" | tail -1 | tr -d '"\\')"
    exit 1
fi

if [ ! -f "$DEST/latest.json" ]; then
    status false "no latest.json after pull"
    exit 1
fi
LATEST_AGE=$(( $(date +%s) - $(date -r "$DEST/latest.json" +%s) ))
# rsync -a keeps the remote mtime, so the file age is clap's last sample time.
if [ "$LATEST_AGE" -gt "$STALE_S" ]; then
    status false "clap stopped sampling (latest.json is ${LATEST_AGE}s old)"
    exit 1
fi
status true "pulled"
