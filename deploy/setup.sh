#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Setup de producción para Sofia (servidor casero) con HTTPS gratis.
#
# Resultado: entras desde CUALQUIER dispositivo de tu red por
#   https://TU-SUBDOMINIO.duckdns.org
# con micrófono funcionando y sin instalar nada en el celular.
#
# Hace:
#   1. Build de producción.
#   2. Instala y arranca el servicio systemd (app en 127.0.0.1:3030).
#   3. Instala nginx (si falta).
#   4. Obtiene el certificado HTTPS (DuckDNS + Let's Encrypt).
#   5. Instala la config de nginx (443 → 3030) con tu dominio y recarga.
#
# Requisitos: rellena en .env.local → DUCKDNS_DOMAIN y DUCKDNS_TOKEN
#   (cuenta gratis en https://www.duckdns.org)
#
# Uso:   bash deploy/setup.sh        (pide sudo para systemd, nginx y el cert)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
echo "Proyecto: $PROJECT_DIR"

ENV_FILE="$PROJECT_DIR/.env.local"
APP_DOMAIN="$(grep -E '^DUCKDNS_DOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'"'"' ' )"
if [ -z "$APP_DOMAIN" ]; then
  echo "✗ Falta DUCKDNS_DOMAIN en .env.local." >&2
  echo "  Crea tu subdominio gratis en https://www.duckdns.org y añádelo (y el token)." >&2
  exit 1
fi
echo "Dominio: $APP_DOMAIN"

# ── 1. Build ────────────────────────────────────────────────────────────────
echo "→ [1/5] Build de producción…"
npm run build

# ── 2. systemd ──────────────────────────────────────────────────────────────
echo "→ [2/5] Instalando servicio systemd…"
NODE_PATH="$(command -v node)"
NEXT_BIN="${PROJECT_DIR}/node_modules/next/dist/bin/next"
USER_NAME="$(whoami)"
UNIT_TMP="$(mktemp)"
sed -e "s#^ExecStart=.*#ExecStart=${NODE_PATH} ${NEXT_BIN} start -p 3030 -H 127.0.0.1#" \
    -e "s#^User=.*#User=${USER_NAME}#" \
    -e "s#^WorkingDirectory=.*#WorkingDirectory=${PROJECT_DIR}#" \
    deploy/systemd/sofia.service > "$UNIT_TMP"
sudo cp "$UNIT_TMP" /etc/systemd/system/sofia.service
rm -f "$UNIT_TMP"
sudo systemctl daemon-reload
sudo systemctl enable --now sofia
echo "  Servicio 'sofia' activo. Logs: journalctl -u sofia -f"

# ── 3. nginx (instalar binario si falta) ────────────────────────────────────
echo "→ [3/5] Asegurando nginx instalado…"
if ! command -v nginx >/dev/null 2>&1; then
  echo "  Instalando nginx con apt…"
  sudo apt-get update -qq
  sudo apt-get install -y nginx
fi

# ── 4. Certificado HTTPS (DuckDNS + Let's Encrypt) ──────────────────────────
echo "→ [4/5] Obteniendo certificado HTTPS…"
sudo bash deploy/get-cert.sh

# ── 5. Config de nginx con tu dominio ───────────────────────────────────────
echo "→ [5/5] Instalando config de nginx (443 → 3030)…"
sudo mkdir -p /etc/nginx/conf.d
CONF_TMP="$(mktemp)"
sed "s/__APP_DOMAIN__/${APP_DOMAIN}/g" deploy/nginx/sofia.conf > "$CONF_TMP"
sudo cp "$CONF_TMP" /etc/nginx/conf.d/sofia.conf
rm -f "$CONF_TMP"
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

echo
echo "✓ Setup completo."
echo
echo "Abre en cualquier dispositivo de tu red (mismo WiFi):"
echo "    https://${APP_DOMAIN}"
echo "El micrófono funcionará: cert válido."
echo
echo "Si tu router bloquea 'DNS rebinding' y el nombre no resuelve en algún"
echo "dispositivo, mira la sección de solución en DEPLOY.md."
echo
echo "Spotify: pon en .env.local"
echo "    SPOTIFY_REDIRECT_URI=https://${APP_DOMAIN}/api/spotify/callback"
echo "  regístrala en https://developer.spotify.com/dashboard y reinicia: sudo systemctl restart sofia"
