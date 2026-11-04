#!/usr/bin/env bash
# Light host + container monitor. Runs from cron as root every few minutes, writes plain files,
# and sends nothing anywhere: another machine pulls /var/lib/clap-monitor and does the alerting.
#
# Output (in $OUT):
#   stats-YYYY-MM-DD.csv       one row per run: host metrics and flag list
#   containers-YYYY-MM-DD.csv  one row per container per run (long format)
#   latest.json                newest sample with computed flags, rewritten atomically
# Past days are never modified, so they can be synced and archived safely.
set -uo pipefail

OUT=${CLAP_MONITOR_OUT:-/var/lib/clap-monitor}
KEEP_DAYS=${CLAP_MONITOR_KEEP_DAYS:-30}
EXPECTED=${CLAP_MONITOR_EXPECTED:-"caddy cadencelanes"}   # containers that must be up and healthy
BACKUP_DIR=${CLAP_MONITOR_BACKUP_DIR:-/home/deploy/backups}
CERT_HOST=${CLAP_MONITOR_CERT_HOST:-cl.lusidlogix.com}

# Thresholds for flags (the puller may apply its own on top).
DISK_PCT=${DISK_PCT:-80}
MEM_USED_PCT=${MEM_USED_PCT:-85}
SWAP_MB=${SWAP_MB:-500}
LOAD_PER_CPU=${LOAD_PER_CPU:-2}
BACKUP_MAX_H=${BACKUP_MAX_H:-26}
CERT_MIN_DAYS=${CERT_MIN_DAYS:-14}

umask 022
mkdir -p "$OUT"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DAY=$(date -u +%Y-%m-%d)
HOST=$(hostname)

# Host metrics
read -r LOAD1 LOAD5 _ < /proc/loadavg
CPUS=$(nproc)
MEM_TOTAL=$(awk '/^MemTotal:/ {printf "%d", $2/1024}' /proc/meminfo)
MEM_AVAIL=$(awk '/^MemAvailable:/ {printf "%d", $2/1024}' /proc/meminfo)
MEM_USED_PCT_NOW=$(( (MEM_TOTAL - MEM_AVAIL) * 100 / MEM_TOTAL ))
SWAP_USED=$(awk '/^SwapTotal:/ {t=$2} /^SwapFree:/ {f=$2} END {printf "%d", (t-f)/1024}' /proc/meminfo)
DISK_NOW=$(df --output=pcent / | tail -1 | tr -dc 0-9)
INODE_NOW=$(df --output=ipcent / | tail -1 | tr -dc 0-9)
UPTIME_D=$(awk '{printf "%d", $1/86400}' /proc/uptime)

# Backup age in hours (999 when there is no archive)
NEWEST=$(find "$BACKUP_DIR" -maxdepth 1 -name 'clap-data-*.tar.gz' -printf '%T@\n' 2>/dev/null | sort -n | tail -1)
if [ -n "${NEWEST:-}" ]; then BACKUP_AGE_H=$(( ($(date +%s) - ${NEWEST%.*}) / 3600 )); else BACKUP_AGE_H=999; fi

# TLS certificate days left (-1 when it cannot be read)
CERT_END=$(echo | timeout 8 openssl s_client -connect 127.0.0.1:443 -servername "$CERT_HOST" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$CERT_END" ]; then CERT_DAYS=$(( ($(date -d "$CERT_END" +%s) - $(date +%s)) / 86400 )); else CERT_DAYS=-1; fi

BANNED=$(fail2ban-client status sshd 2>/dev/null | awk -F'\t' '/Currently banned/ {print $2}')
BANNED=${BANNED:-0}
REBOOT=0; [ -f /var/run/reboot-required ] && REBOOT=1

# Containers (state and health), plus CPU and memory for running ones
CSV_C="$OUT/containers-$DAY.csv"
[ -f "$CSV_C" ] || echo "ts,name,state,health,restarts,cpu_pct,mem_mb" > "$CSV_C"
declare -A STATS
while IFS=, read -r name cpu mem; do
    used=${mem%% /*}
    case "$used" in
        *GiB) mb=$(awk -v v="${used%GiB}" 'BEGIN {printf "%d", v*1024}') ;;
        *MiB) mb=$(awk -v v="${used%MiB}" 'BEGIN {printf "%d", v}') ;;
        *KiB) mb=0 ;;
        *) mb=0 ;;
    esac
    STATS[$name]="${cpu%\%},$mb"
done < <(docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}}' 2>/dev/null)

declare -A STATE HEALTH
while IFS=, read -r name state health restarts; do
    name=${name#/}
    STATE[$name]=$state; HEALTH[$name]=$health
    echo "$NOW,$name,$state,$health,$restarts,${STATS[$name]:-0,0}" >> "$CSV_C"
done < <(docker ps -aq 2>/dev/null | xargs -r docker inspect \
    -f '{{.Name}},{{.State.Status}},{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}},{{.RestartCount}}')

# Flags
FLAGS=()
[ "$DISK_NOW" -ge "$DISK_PCT" ] && FLAGS+=(disk_high)
[ "$INODE_NOW" -ge "$DISK_PCT" ] && FLAGS+=(inodes_high)
[ "$MEM_USED_PCT_NOW" -ge "$MEM_USED_PCT" ] && FLAGS+=(mem_high)
[ "$SWAP_USED" -ge "$SWAP_MB" ] && FLAGS+=(swap_active)
awk -v l="$LOAD5" -v m="$LOAD_PER_CPU" -v c="$CPUS" 'BEGIN {exit !(l > m*c)}' && FLAGS+=(load_high)
[ "$BACKUP_AGE_H" -ge "$BACKUP_MAX_H" ] && FLAGS+=(backup_stale)
{ [ "$CERT_DAYS" -ge 0 ] && [ "$CERT_DAYS" -lt "$CERT_MIN_DAYS" ]; } && FLAGS+=(cert_expiring)
[ "$CERT_DAYS" -lt 0 ] && FLAGS+=(cert_unreadable)
[ "$REBOOT" -eq 1 ] && FLAGS+=(reboot_required)
DOWN=()
for c in $EXPECTED; do
    if [ "${STATE[$c]:-missing}" != "running" ] || { [ "${HEALTH[$c]:-none}" != "healthy" ] && [ "${HEALTH[$c]:-none}" != "none" ]; }; then
        DOWN+=("$c")
    fi
done
[ ${#DOWN[@]} -gt 0 ] && FLAGS+=(container_down)
FLAG_STR=$(IFS='|'; echo "${FLAGS[*]:-}")

# Append the row
CSV_S="$OUT/stats-$DAY.csv"
[ -f "$CSV_S" ] || echo "ts,load1,load5,cpus,mem_total_mb,mem_avail_mb,mem_used_pct,swap_used_mb,disk_pct,inode_pct,backup_age_h,cert_days,banned,reboot_required,uptime_days,flags" > "$CSV_S"
echo "$NOW,$LOAD1,$LOAD5,$CPUS,$MEM_TOTAL,$MEM_AVAIL,$MEM_USED_PCT_NOW,$SWAP_USED,$DISK_NOW,$INODE_NOW,$BACKUP_AGE_H,$CERT_DAYS,$BANNED,$REBOOT,$UPTIME_D,$FLAG_STR" >> "$CSV_S"

# latest.json (atomic replace)
json_list() { local out="" x; for x in "$@"; do out+="${out:+,}\"$x\""; done; echo "[$out]"; }
TMP=$(mktemp "$OUT/.latest.XXXXXX")
cat > "$TMP" <<EOF
{"ts":"$NOW","host":"$HOST","ok":$([ ${#FLAGS[@]} -eq 0 ] && echo true || echo false),
 "flags":$(json_list "${FLAGS[@]:-}" | sed 's/\[""\]/[]/'),
 "containers_down":$(json_list "${DOWN[@]:-}" | sed 's/\[""\]/[]/'),
 "load1":$LOAD1,"load5":$LOAD5,"cpus":$CPUS,
 "mem_total_mb":$MEM_TOTAL,"mem_avail_mb":$MEM_AVAIL,"mem_used_pct":$MEM_USED_PCT_NOW,"swap_used_mb":$SWAP_USED,
 "disk_pct":$DISK_NOW,"inode_pct":$INODE_NOW,"backup_age_h":$BACKUP_AGE_H,"cert_days":$CERT_DAYS,
 "banned":$BANNED,"reboot_required":$REBOOT,"uptime_days":$UPTIME_D}
EOF
chmod 644 "$TMP"
mv -f "$TMP" "$OUT/latest.json"

# Retention
find "$OUT" -maxdepth 1 -type f \( -name 'stats-*.csv' -o -name 'containers-*.csv' \) -mtime +"$KEEP_DAYS" -delete
