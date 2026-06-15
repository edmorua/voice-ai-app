#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Obtiene (y configura la renovación automática de) un certificado HTTPS VÁLIDO
# y gratuito para tu subdominio DuckDNS, usando Let's Encrypt vía reto DNS-01.
#
# El reto DNS-01 NO requiere abrir puertos al internet: acme.sh crea un registro
# TXT temporal en DuckDNS con tu token. Por eso funciona en una red doméstica.
#
# Requisitos en .env.local:
#   DUCKDNS_DOMAIN=sofia-eduardo.duckdns.org
#   DUCKDNS_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#
# Uso:   sudo bash deploy/get-cert.sh
# (sudo: instala acme.sh como root y escribe el cert en /etc/nginx/ssl, así la
#  renovación automática por cron también puede recargar nginx sin pedir clave.)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "✗ Ejecuta con sudo:  sudo bash deploy/get-cert.sh" >&2
  exit 1
fi

# acme.sh se niega a correr si ve variables SUDO_* (las interpreta como un sudo
# "inseguro"). Como ya somos root, las limpiamos para que opere con normalidad.
unset SUDO_UID SUDO_GID SUDO_USER SUDO_COMMAND 2>/dev/null || true

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env.local"

# ── Cargar DUCKDNS_DOMAIN y DUCKDNS_TOKEN desde .env.local ───────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "✗ No existe $ENV_FILE. Copia .env.local.example y rellénalo." >&2
  exit 1
fi
DUCKDNS_DOMAIN="$(grep -E '^DUCKDNS_DOMAIN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'"' ' )"
DUCKDNS_TOKEN="$(grep -E '^DUCKDNS_TOKEN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'"' ' )"

if [ -z "$DUCKDNS_DOMAIN" ] || [ -z "$DUCKDNS_TOKEN" ]; then
  echo "✗ Falta DUCKDNS_DOMAIN o DUCKDNS_TOKEN en $ENV_FILE." >&2
  echo "  Crea tu cuenta y subdominio gratis en https://www.duckdns.org" >&2
  exit 1
fi

# Etiqueta del subdominio (sin .duckdns.org) para la API de actualización.
SUBDOMAIN="${DUCKDNS_DOMAIN%%.duckdns.org}"

# IP LAN de esta máquina (la que verán los dispositivos de la red).
LAN_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[\d.]+' | head -1)"
LAN_IP="${LAN_IP:-192.168.1.76}"

echo "→ Dominio:  $DUCKDNS_DOMAIN"
echo "→ IP LAN:   $LAN_IP"

# ── 1. Apuntar el subdominio DuckDNS a la IP local ──────────────────────────
echo "→ [1/3] Apuntando $DUCKDNS_DOMAIN → $LAN_IP en DuckDNS…"
RESP="$(curl -fsS "https://www.duckdns.org/update?domains=${SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip=${LAN_IP}" || true)"
if [ "$RESP" != "OK" ]; then
  echo "✗ DuckDNS respondió: '$RESP' (esperaba 'OK'). Revisa subdominio/token." >&2
  exit 1
fi
echo "  OK"

# ── 2. Instalar acme.sh (si falta) y usar Let's Encrypt ─────────────────────
ACME_HOME="/root/.acme.sh"
if [ ! -x "$ACME_HOME/acme.sh" ]; then
  echo "→ [2/3] Instalando acme.sh…"
  curl -fsS https://get.acme.sh | sh -s email="admin@${DUCKDNS_DOMAIN}"
else
  echo "→ [2/3] acme.sh ya instalado."
fi
ACME="$ACME_HOME/acme.sh"
"$ACME" --set-default-ca --server letsencrypt

# ── 3. Emitir e instalar el certificado ─────────────────────────────────────
echo "→ [3/3] Emitiendo certificado para $DUCKDNS_DOMAIN (reto DNS-01)…"
export DuckDNS_Token="$DUCKDNS_TOKEN"
# acme.sh devuelve 2 cuando el cert ya existe y aún no toca renovar: eso NO es
# un error, así que lo toleramos. Cualquier otro código sí es fallo real.
issue_rc=0
"$ACME" --issue --dns dns_duckdns -d "$DUCKDNS_DOMAIN" --dnssleep 30 || issue_rc=$?
if [ "$issue_rc" -ne 0 ] && [ "$issue_rc" -ne 2 ]; then
  echo "✗ acme.sh falló al emitir el certificado (código $issue_rc)." >&2
  exit 1
fi

mkdir -p /etc/nginx/ssl/sofia
"$ACME" --install-cert -d "$DUCKDNS_DOMAIN" \
  --key-file       /etc/nginx/ssl/sofia/key.pem \
  --fullchain-file /etc/nginx/ssl/sofia/fullchain.pem \
  --reloadcmd      "systemctl reload nginx 2>/dev/null || true"

echo
echo "✓ Certificado instalado en /etc/nginx/ssl/sofia/"
echo "  acme.sh renovará automáticamente cada 60 días (cron de root)."
