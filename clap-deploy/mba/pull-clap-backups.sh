#!/usr/bin/env bash
# Run on the backup machine (the MacBook Air). Copies clap's nightly backup archives to a local folder.
# Read-only: the key it uses is restricted on clap to `rrsync -ro /home/deploy/backups`.
#
#   ~/bin/pull-clap-backups.sh          # normally run from cron once a day, after clap's 02:00 IST backup
#
# Results in $DEST:
#   clap-data-<timestamp>.tar.gz        every archive clap still has; already pulled ones are never re-copied
#                                       and are kept here after clap deletes them (clap keeps 14 days)
#   backups-pull-status.json            outcome of the last pull (for the alerter)
#   pull-backups.log                    short log, trimmed automatically
# Archives hold the databases (phone numbers, names): keep $DEST private (mode 700, files stay mode 600).
set -uo pipefail

CLAP_HOST=${CLAP_HOST:-clap}
CLAP_USER=${CLAP_USER:-deploy}
KEY=${CLAP_BACKUP_KEY:-$HOME/.ssh/clap_backup_ed25519}
DEST=${CLAP_BACKUP_DEST:-$HOME/clap-backups}
REMOTE=${CLAP_BACKUP_REMOTE:-./}           # relative to the rrsync root, which is /home/deploy/backups
MAX_AGE_H=${CLAP_BACKUP_MAX_AGE_H:-26}     # newest archive older than this means clap's backup stopped
KEEP_DAYS=${CLAP_BACKUP_KEEP_DAYS:-0}      # 0 keeps everything here; a number prunes local archives older than that

umask 077
mkdir -p "$DEST"
chmod 700 "$DEST"
exec 9>"$DEST/.pull.lock"
flock -n 9 || exit 0

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
NEWEST=""; AGE_H=-1; COUNT=0
status() {  # ok, message
    printf '{"pulled_at":"%s","ok":%s,"newest":"%s","newest_age_h":%s,"archives":%s,"message":"%s"}\n' \
        "$NOW" "$1" "$NEWEST" "$AGE_H" "$COUNT" "$2" > "$DEST/backups-pull-status.json.tmp"
    mv -f "$DEST/backups-pull-status.json.tmp" "$DEST/backups-pull-status.json"
    echo "$NOW ok=$1 newest=${NEWEST:-none} age_h=$AGE_H archives=$COUNT $2" >> "$DEST/pull-backups.log"
    tail -n 2000 "$DEST/pull-backups.log" > "$DEST/pull-backups.log.tmp" && mv -f "$DEST/pull-backups.log.tmp" "$DEST/pull-backups.log"
}

# --ignore-existing: an archive already here is never touched again. Hidden names (clap's temp work dirs) are skipped.
if ! OUT=$(rsync -a --ignore-existing --partial --timeout=120 --include 'clap-data-*.tar.gz' --exclude '*' \
        -e "ssh -i $KEY -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes" \
        "$CLAP_USER@$CLAP_HOST:$REMOTE" "$DEST/" 2>&1); then
    status false "rsync failed: $(echo "$OUT" | tail -1 | tr -d '"\\')"
    exit 1
fi

NEWEST=$(ls -1 "$DEST"/clap-data-*.tar.gz 2>/dev/null | sort | tail -1)
COUNT=$(ls -1 "$DEST"/clap-data-*.tar.gz 2>/dev/null | wc -l | tr -d ' ')
if [ -z "$NEWEST" ]; then
    status false "no backup archives here after the pull"
    exit 1
fi

# The archive's mtime is clap's creation time (rsync -a keeps it).
AGE_H=$(( ($(date +%s) - $(date -r "$NEWEST" +%s)) / 3600 ))
NEWEST=$(basename "$NEWEST")

# The newest archive must be a readable gzip tar; a truncated copy would be a useless backup.
if ! gzip -t "$DEST/$NEWEST" 2>/dev/null || ! tar -tzf "$DEST/$NEWEST" >/dev/null 2>&1; then
    status false "newest archive is corrupt or incomplete"
    exit 1
fi

if [ "$AGE_H" -gt "$MAX_AGE_H" ]; then
    status false "newest backup is ${AGE_H}h old, clap's backup may have stopped"
    exit 1
fi

if [ "$KEEP_DAYS" -gt 0 ]; then
    find "$DEST" -maxdepth 1 -name 'clap-data-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
fi
status true "pulled"
