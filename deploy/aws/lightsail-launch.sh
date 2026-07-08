#!/bin/bash
# Paste this into the Lightsail "Launch script" box when creating an
# Ubuntu 24.04 instance (or run it once over SSH). It installs Docker,
# fetches the app, and starts everything.
set -e
apt-get update -y
apt-get install -y docker.io docker-compose-v2 unzip
systemctl enable --now docker

mkdir -p /opt/sahyatri && cd /opt/sahyatri
# --- Put the code here: either `git clone <your-repo> .`
# --- or upload sahyatri.zip and: unzip sahyatri.zip
if [ ! -f package.json ]; then
  echo "Upload the Sahyatri code to /opt/sahyatri (git clone or unzip), then re-run:"
  echo "  cd /opt/sahyatri && cp .env.production.example .env && nano .env"
  echo "  docker compose -f docker-compose.prod.yml up -d"
  exit 0
fi

[ -f .env ] || cp .env.production.example .env
docker compose -f docker-compose.prod.yml up -d --build
