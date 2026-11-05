#!/usr/bin/env bash
# One-time hardening of the clap host (Ubuntu 24.04). Safe to re-run.
# Run as root or with sudo, from this directory, and keep a second root session open
# while testing SSH: it disables password and root login.
#   sudo ./harden.sh <deploy-user> [account-to-lock]
set -euo pipefail

DEPLOY_USER=${1:?usage: harden.sh <deploy-user> [account-to-lock]}
LOCK_USER=${2:-}
HERE=$(cd "$(dirname "$0")" && pwd)
export DEBIAN_FRONTEND=noninteractive

# The deploy user must already have a working key, or this locks everyone out.
KEYS=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)/.ssh/authorized_keys
[ -s "$KEYS" ] || { echo "no authorized_keys for $DEPLOY_USER, refusing to continue" >&2; exit 1; }

apt-get update -qq
apt-get install -y -qq ufw fail2ban auditd chrony unattended-upgrades curl ca-certificates

# SSH: keys only, no root, one allowed user. 00- sorts before cloud-init's 50- file (first match wins).
sed "s/^AllowUsers .*/AllowUsers $DEPLOY_USER/" "$HERE/sshd-hardening.conf" > /etc/ssh/sshd_config.d/00-hardening.conf
sshd -t
systemctl reload ssh

# Firewall: default deny, SSH rate-limited, web ports open.
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# Brute force protection, kernel settings, journald size.
install -m 0644 "$HERE/fail2ban-sshd.local" /etc/fail2ban/jail.d/sshd.local
systemctl enable --now fail2ban
systemctl restart fail2ban
install -m 0644 "$HERE/99-hardening.conf" /etc/sysctl.d/99-hardening.conf
sysctl --system >/dev/null
install -d /etc/systemd/journald.conf.d
install -m 0644 "$HERE/journald-size.conf" /etc/systemd/journald.conf.d/size.conf
systemctl restart systemd-journald

# Disable services a VPS does not need.
for s in ModemManager udisks2 upower multipathd; do
    systemctl disable --now "$s" >/dev/null 2>&1 || true
done

# Lock a leftover image account (password, expiry, sudo membership).
if [ -n "$LOCK_USER" ] && id "$LOCK_USER" >/dev/null 2>&1; then
    passwd -l "$LOCK_USER" >/dev/null
    chage -E 0 "$LOCK_USER"
    gpasswd -d "$LOCK_USER" sudo >/dev/null 2>&1 || true
fi

# Docker Engine from the official repository, with log rotation and no-new-privileges.
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
apt-get update -qq
mkdir -p /etc/docker
install -m 0644 "$HERE/docker-daemon.json" /etc/docker/daemon.json
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

# Layout used by deploy.sh. The deploy user stays out of the docker group (it is root-equivalent).
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/proxy /opt/apps /opt/apps/cadencelanes /opt/apps/pkndr/src
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$(dirname "$KEYS")/../backups"
echo "hardening done"
