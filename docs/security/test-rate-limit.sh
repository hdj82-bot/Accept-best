#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# Rate Limit 테스트 스크립트
#
# 대상: academi.ai API — rate limit 동작 및 우회 시도 검증
# 사용: ./test-rate-limit.sh https://api.academi.ai <VALID_JWT>
#
# 종료코드: 0 = 모든 테스트 통과, 1 = 하나 이상 실패
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL="${1:?Usage: $0 <BASE_URL> <VALID_JWT>}"
JWT="${2:?Usage: $0 <BASE_URL> <VALID_JWT>}"

PASS=0
FAIL=0
TOTAL=0

pass() { ((PASS++)); ((TOTAL++)); echo "  ✅ PASS: $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo "  ❌ FAIL: $1 — $2"; }

echo "============================================"
echo " Rate Limit 보안 테스트"
echo " 대상: $BASE_URL"
echo "============================================"
echo ""

# ── 1. 기본 rate limit 트리거 ────────────────────────────────────────
echo "▸ 1. 논문 검색 rate limit (60 req/min)"

GOT_429=false
for i in $(seq 1 80); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/papers/search" \
    -d '{"query":"rate-limit-test"}')
  if [ "$STATUS" = "429" ]; then
    GOT_429=true
    echo "  → 429 수신: ${i}번째 요청"
    break
  fi
done

if $GOT_429; then
  pass "검색 rate limit 트리거됨"
else
  fail "검색 rate limit 미동작" "80회 요청 후에도 429 미수신"
fi

# ── 2. Retry-After 헤더 확인 ─────────────────────────────────────────
echo ""
echo "▸ 2. 429 응답에 Retry-After 헤더 포함 여부"

RETRY_AFTER=$(curl -s -o /dev/null -D - \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/papers/search" \
  -d '{"query":"rate-limit-test"}' | grep -i "retry-after" || true)

if [ -n "$RETRY_AFTER" ]; then
  pass "Retry-After 헤더 존재: $RETRY_AFTER"
else
  fail "Retry-After 헤더 누락" "429 응답에 Retry-After가 없음"
fi

echo "  → 10초 대기 후 계속..."
sleep 10

# ── 3. X-Forwarded-For 스푸핑 우회 시도 ────────────────────���─────────
echo ""
echo "▸ 3. X-Forwarded-For 스푸핑 우회 시도"

GOT_429_SPOOF=false
for i in $(seq 1 80); do
  FAKE_IP="10.$(( RANDOM % 256 )).$(( RANDOM % 256 )).$(( RANDOM % 256 ))"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: $FAKE_IP" \
    -X POST "$BASE_URL/api/papers/search" \
    -d '{"query":"spoof-test"}')
  if [ "$STATUS" = "429" ]; then
    GOT_429_SPOOF=true
    echo "  → 429 수신: ${i}번째 요청 (IP 스푸핑 무시됨)"
    break
  fi
done

if $GOT_429_SPOOF; then
  pass "X-Forwarded-For 스푸핑으로 rate limit 우회 불가"
else
  fail "X-Forwarded-For 스푸핑 우회 가능" "80회 위조 IP 요청 후에도 429 미수신"
fi

sleep 10

# ── 4. User-Agent 로테이션 우회 시도 ─────────────────────────────────
echo ""
echo "▸ 4. User-Agent 로테이션 우회 시도"

USER_AGENTS=(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
  "curl/7.88.1"
  "PostmanRuntime/7.32.1"
  "python-requests/2.31.0"
)

GOT_429_UA=false
for i in $(seq 1 80); do
  UA="${USER_AGENTS[$((i % ${#USER_AGENTS[@]}))]}"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -H "User-Agent: $UA" \
    -X POST "$BASE_URL/api/papers/search" \
    -d '{"query":"ua-rotate-test"}')
  if [ "$STATUS" = "429" ]; then
    GOT_429_UA=true
    echo "  → 429 수신: ${i}번째 요청 (UA 로테이션 무시됨)"
    break
  fi
done

if $GOT_429_UA; then
  pass "User-Agent 로테이션으로 rate limit 우회 불가"
else
  fail "User-Agent 로테이션 우회 가능" "80회 다중 UA 요청 후에도 429 미수신"
fi

sleep 10

# ── 5. Export 엔드포인트 rate limit ───────────────────────────��──────
echo ""
echo "▸ 5. Export 엔드포인트 rate limit (10 req/min)"

GOT_429_EXPORT=false
for i in $(seq 1 15); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    -X POST "$BASE_URL/api/export/markdown/test-note-id")
  if [ "$STATUS" = "429" ]; then
    GOT_429_EXPORT=true
    echo "  → 429 수신: ${i}번째 요청"
    break
  fi
done

if $GOT_429_EXPORT; then
  pass "Export rate limit 트리거됨"
else
  fail "Export rate limit 미동작" "15회 요청 후에도 429 미수신"
fi

# ── 6. 미인증 IP 기반 제한 ─────────────────���─────────────────────────
echo ""
echo "▸ 6. 미인증 요청 IP 기반 rate limit"

GOT_429_ANON=false
for i in $(seq 1 50); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/api/auth/csrf")
  if [ "$STATUS" = "429" ]; then
    GOT_429_ANON=true
    echo "  → 429 수신: ${i}번째 요청"
    break
  fi
done

if $GOT_429_ANON; then
  pass "미인증 IP 기반 rate limit 동작"
else
  fail "미인증 IP 기반 rate limit 미동작" "50회 요청 후에도 429 미수신"
fi

# ── 결과 요약 ────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo " 결과: $PASS/$TOTAL 통과, $FAIL 실패"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
