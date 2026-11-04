#!/usr/bin/env bash
# Daily backup of the Docker data volumes into /home/deploy/backups.
# SQLite files are copied with the online backup API, so the copy is consistent
# while the apps are running. Installed to /usr/local/sbin and run from cron as root.
set -euo pipefail

DEST=/home/deploy/backups
KEEP_DAYS=14
VOLUMES=(cadencelanes_cadencelanes-data pkndr_pkndr-data)
STAMP=$(date -u +%Y%m%d-%H%M%S)
WORK=$(mktemp -d "$DEST/.work-$STAMP-XXXX")
trap 'rm -rf "$WORK"' EXIT

PY='
import pathlib, shutil, sqlite3, sys
src, dst = pathlib.Path("/data"), pathlib.Path("/out")
for p in sorted(src.rglob("*")):
    if not p.is_file() or p.name.endswith(("-wal", "-shm", "-journal")):
        continue
    out = dst / p.relative_to(src)
    out.parent.mkdir(parents=True, exist_ok=True)
    if p.suffix == ".db":
        s = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
        d = sqlite3.connect(out)
        s.backup(d)
        ok = d.execute("PRAGMA integrity_check").fetchone()[0]
        s.close(); d.close()
        if ok != "ok":
            sys.exit(f"integrity check failed for {p}: {ok}")
    else:
        shutil.copy2(p, out)
'

for vol in "${VOLUMES[@]}"; do
    if ! docker volume inspect "$vol" >/dev/null 2>&1; then
        logger -t clap-backup "volume $vol not found, skipping"
        continue
    fi
    mkdir -p "$WORK/$vol"
    docker run --rm --network none -v "$vol":/data:ro -v "$WORK/$vol":/out \
        python:3.12-slim python -c "$PY"
done

ARCHIVE="$DEST/clap-data-$STAMP.tar.gz"
tar -C "$WORK" -czf "$ARCHIVE" .
chown deploy:deploy "$ARCHIVE"
chmod 600 "$ARCHIVE"

find "$DEST" -maxdepth 1 -name 'clap-data-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
logger -t clap-backup "ok $(basename "$ARCHIVE") $(du -h "$ARCHIVE" | cut -f1)"
