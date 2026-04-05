#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# academi.ai — Let's Encrypt SSL 초기 발급 스크립트
#
# 사용법:
#   DOMAIN=academi.ai EMAIL=admin@academi.ai ./infra/scripts/init-ssl.sh
#
# 사전 조건:
#   1. 도메인 DNS가 서버 IP를 가리키고 있어야 함
#   2. 80 포트가 열려 있어야 함
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${DOMAIN:?DOMAIN 환경변수를 설정하세요 (예: academi.ai)}"
EMAIL="${EMAIL:?EMAIL 환경변수를 설정하세요 (예: admin@academi.ai)}"
STAGING="${STAGING:-0}"  # 1로 설정하면 Let's Encrypt 스테이징 서버 사용 (테스트용)

COMPOSE_FILE="/srv/academi.ai/docker-compose.prod.yml"

echo "=== academi.ai SSL 인증서 발급 ==="
echo "도메인: ${DOMAIN}"
echo "이메일: ${EMAIL}"
echo "스테이징: ${STAGING}"
echo ""

# ── Step 1: 임시 self-signed 인증서로 nginx 시작 ──────────────────
echo "[1/4] 임시 인증서 생성..."
docker compose -f "${COMPOSE_FILE}" run --rm --entrypoint "" certbot sh -c "
  mkdir -p /etc/letsencrypt/live/${DOMAIN}
  if [ ! -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout /etc/letsencrypt/live/${DOMAIN}/privkey.pem \
      -out /etc/letsencrypt/live/${DOMAIN}/fullchain.pem \
      -subj '/CN=${DOMAIN}'
  fi
"

# ── Step 2: nginx 시작 (임시 인증서로) ─────────────────────────────
echo "[2/4] nginx 시작..."
docker compose -f "${COMPOSE_FILE}" up -d nginx

echo "nginx 시작 대기 (5초)..."
sleep 5

# ── Step 3: 임시 인증서 삭제 & 실제 발급 ─────────────────────────
echo "[3/4] Let's Encrypt 인증서 발급..."

STAGING_FLAG=""
if [ "${STAGING}" = "1" ]; then
  STAGING_FLAG="--staging"
fi

docker compose -f "${COMPOSE_FILE}" run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  -d "${DOMAIN}" \
  ${STAGING_FLAG} \
  --force-renewal

# ── Step 4: nginx 재시작 (실제 인증서 적용) ────────────────────────
echo "[4/4] nginx 재시작 (실제 인증서 적용)..."
docker compose -f "${COMPOSE_FILE}" exec nginx nginx -s reload

echo ""
echo "=== SSL 인증서 발급 완료! ==="
echo "인증서 경로: /etc/letsencrypt/live/${DOMAIN}/"
echo ""
echo "자동 갱신은 certbot 컨테이너가 12시간마다 확인합니다."
echo "수동 갱신: docker compose -f docker-compose.prod.yml run --rm certbot renew"
