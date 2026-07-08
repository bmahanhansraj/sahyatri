#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Sahyatri — Lightsail / EC2 one-time setup script
#
# Run this once on a fresh Ubuntu 24.04 server (paste into Lightsail launch
# script, or run over SSH). It installs Docker, unzips the app, and starts
# everything. After this, the app is accessible at your server's IP on port 80.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "=== Installing Docker ==="
apt-get update -y
apt-get install -y docker.io docker-compose-v2 unzip curl

# Enable Docker and add current user to the docker group
systemctl enable --now docker
usermod -aG docker ubuntu 2>/dev/null || true   # non-fatal if user doesn't exist

echo "=== Setting up Sahyatri ==="
mkdir -p /opt/sahyatri
cd /opt/sahyatri

# ── Option A: unzip uploaded archive ─────────────────────────────────────────
if [ -f /home/ubuntu/sahyatri.zip ]; then
  unzip -qo /home/ubuntu/sahyatri.zip -d .
  echo "Extracted sahyatri.zip"

# ── Option B: clone from GitHub ──────────────────────────────────────────────
elif [ -n "${GITHUB_REPO:-}" ]; then
  apt-get install -y git
  git clone "https://github.com/${GITHUB_REPO}.git" .
  echo "Cloned ${GITHUB_REPO}"

else
  echo ""
  echo "──────────────────────────────────────────────────────"
  echo "  CODE NOT FOUND — two ways to add it:"
  echo ""
  echo "  Option A (zip upload):"
  echo "    1. Upload sahyatri.zip to /home/ubuntu/ via the Lightsail file"
  echo "       transfer or: scp sahyatri.zip ubuntu@YOUR-IP:/home/ubuntu/"
  echo "    2. Re-run this script: bash /opt/sahyatri/deploy/aws/lightsail-launch.sh"
  echo ""
  echo "  Option B (GitHub):"
  echo "    GITHUB_REPO=yourname/sahyatri bash lightsail-launch.sh"
  echo "──────────────────────────────────────────────────────"
  exit 0
fi

# ── Create .env if it doesn't exist yet ──────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.production.example .env

  # Auto-generate secure secrets so the app works immediately
  DB_PASS=$(openssl rand -base64 32 | tr -d '=+/' | head -c 40)
  AUTH_SEC=$(openssl rand -base64 32 | tr -d '=+/' | head -c 40)

  sed -i "s|change-me-to-something-long-and-random|${DB_PASS}|" .env
  sed -i "s|change-me-to-another-long-random-string|${AUTH_SEC}|" .env

  echo ""
  echo "✓ .env created with auto-generated secrets."
  echo "  To add integrations (Razorpay, SMS, KYC), edit /opt/sahyatri/.env"
  echo "  then run: docker compose -f docker-compose.prod.yml up -d"
fi

echo "=== Starting Sahyatri ==="
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "✓ Sahyatri is starting up!"
echo "  It will be ready in ~2 minutes at: http://$(curl -s ifconfig.me 2>/dev/null || echo YOUR-SERVER-IP)"
echo ""
echo "  To add HTTPS once your domain is pointed here:"
echo "    1. Edit /opt/sahyatri/.env  → set DOMAIN=yourdomain.com"
echo "    2. Run: docker compose -f /opt/sahyatri/docker-compose.prod.yml up -d"
echo ""
echo "  To view logs:   docker compose -f /opt/sahyatri/docker-compose.prod.yml logs -f"
echo "  To restart:     docker compose -f /opt/sahyatri/docker-compose.prod.yml restart"
echo "  To stop:        docker compose -f /opt/sahyatri/docker-compose.prod.yml down"
