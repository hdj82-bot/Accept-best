#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# academi.ai — PostgreSQL 자동 백업 스크립트
#
# 사용법:
#   ./infra/scripts/backup.sh              # 즉시 백업 실행
#
# crontab 등록 (매일 새벽 3시):
#   0 3 * * * cd /srv/academi.ai && ./infra/scripts/backup.sh >> /var/log/academi-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_DIR="/srv/academi.ai/infra/scripts/backups"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/academi_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] 백업 시작..."

# Docker 컨테이너 내에서 pg_dump 실행
docker compose -f /srv/academi.ai/docker-compose.prod.yml exec -T db \
  pg_dump -U "${POSTGRES_USER:-academi}" "${POSTGRES_DB:-academi}" \
  --no-owner --no-privileges \
  | gzip > "${BACKUP_FILE}"

# 파일 크기 확인
FILESIZE=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null)
if [ "${FILESIZE}" -lt 1000 ]; then
  echo "[$(date)] 경고: 백업 파일이 비정상적으로 작습니다 (${FILESIZE} bytes)"
  exit 1
fi

echo "[$(date)] 백업 완료: ${BACKUP_FILE} ($(numfmt --to=iec ${FILESIZE}))"

# 오래된 백업 삭제
DELETED=$(find "${BACKUP_DIR}" -name "academi_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
if [ "${DELETED}" -gt 0 ]; then
  echo "[$(date)] ${RETENTION_DAYS}일 이상 된 백업 ${DELETED}개 삭제"
fi

echo "[$(date)] 백업 작업 완료"
