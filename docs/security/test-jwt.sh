#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# JWT 보안 테스트 스크립트
#
# 대상: academi.ai API — JWT 만료, 변조, 빈값 등을 테스트
# 사용: ./test-jwt.sh https://api.academi.ai <VALID_JWT>
#
# 종료코드: 0 = 모든 테스트 통과, 1 = 하나 이상 실패
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL="${1:?Usage: $0 <BASE_URL> <VALID_JWT>}"
VALID_JWT="${2:?Usage: $0 <BASE_URL> <VALID_JWT>}"

PASS=0
FAIL=0
TOTAL=0

pass() { ((PASS++)); ((TOTAL++)); echo "  ✅ PASS: $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo "  ❌ FAIL: $1 — $2"; }

assert_status() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    pass "$desc"
  else
    fail "$desc" "expected $expected, got $actual"
  fi
}

http_status() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

echo "============================================"
echo " JWT 보안 테스트"
echo " 대상: $BASE_URL"
echo "============================================"
echo ""

# ── 1. 유효한 토큰 기본 검증 ─────────────────────────���───────────────
echo "▸ 1. 유효 토큰 기본 검증"
STATUS=$(http_status -H "Authorization: Bearer $VALID_JWT" "$BASE_URL/api/users/me")
assert_status "유효한 JWT로 /api/users/me 접근 → 200" 200 "$STATUS"

# ── 2. 토큰 없이 요청 ────────────────────────────────────────────────
echo ""
echo "▸ 2. 토큰 없이 보호된 엔드포인트 요청"
STATUS=$(http_status "$BASE_URL/api/users/me")
assert_status "Authorization 헤더 없이 요청 → 401" 401 "$STATUS"

# ── 3. 빈 토큰 ───────────────────────────────────────────────────────
echo ""
echo "▸ 3. 빈 Bearer 토큰"
STATUS=$(http_status -H "Authorization: Bearer " "$BASE_URL/api/users/me")
assert_status "빈 Bearer 토큰 → 401" 401 "$STATUS"

# ── 4. 임의 문자열 토큰 ──────────────────────────────────────────────
echo ""
echo "▸ 4. 임의 문자열 토큰"
STATUS=$(http_status -H "Authorization: Bearer not-a-jwt-at-all" "$BASE_URL/api/users/me")
assert_status "임의 문자열 토큰 → 401" 401 "$STATUS"

# ── 5. 변조된 payload (서명 유지) ────────────────────────────────────
echo ""
echo "▸ 5. payload 변조 (서명 불일치)"
IFS='.' read -r HEADER PAYLOAD SIGNATURE <<< "$VALID_JWT"
DECODED=$(echo "$PAYLOAD" | base64 -d 2>/dev/null || echo '{}')
TAMPERED=$(echo "$DECODED" | sed 's/}$/,"admin":true}/' | base64 -w0 | tr '+/' '-_' | tr -d '=')
TAMPERED_JWT="${HEADER}.${TAMPERED}.${SIGNATURE}"
STATUS=$(http_status -H "Authorization: Bearer $TAMPERED_JWT" "$BASE_URL/api/users/me")
assert_status "payload 변조 + 원본 서명 → 401" 401 "$STATUS"

# ── 6. 서명 제거 (alg=none 시도) ─────────────────────────────────────
echo ""
echo "▸ 6. 서명 제거 (alg=none 공격)"
NONE_HEADER=$(echo -n '{"alg":"none","typ":"JWT"}' | base64 -w0 | tr '+/' '-_' | tr -d '=')
NONE_JWT="${NONE_HEADER}.${PAYLOAD}."
STATUS=$(http_status -H "Authorization: Bearer $NONE_JWT" "$BASE_URL/api/users/me")
assert_status "alg=none 토큰 → 401" 401 "$STATUS"

# ── 7. 만료된 토큰 시뮬레이션 ────────────────────────────────────────
echo ""
echo "▸ 7. 만료된 토큰"
EXPIRED_PAYLOAD=$(echo -n '{"sub":"user-1","exp":1000000000}' | base64 -w0 | tr '+/' '-_' | tr -d '=')
EXPIRED_JWT="${HEADER}.${EXPIRED_PAYLOAD}.${SIGNATURE}"
STATUS=$(http_status -H "Authorization: Bearer $EXPIRED_JWT" "$BASE_URL/api/users/me")
assert_status "만료된 토큰(exp=2001) → 401" 401 "$STATUS"

# ── 8. 잘린 토큰 (signature 없음) ────────────────────────────────────
echo ""
echo "▸ 8. 잘린 토큰 (signature 누락)"
TRUNCATED_JWT="${HEADER}.${PAYLOAD}"
STATUS=$(http_status -H "Authorization: Bearer $TRUNCATED_JWT" "$BASE_URL/api/users/me")
assert_status "signature 없는 잘린 토큰 → 401" 401 "$STATUS"

# ── 9. Bearer 대소문자 ───────────────────────────────────────────────
echo ""
echo "▸ 9. 잘못된 Authorization 스키마"
STATUS=$(http_status -H "Authorization: Token $VALID_JWT" "$BASE_URL/api/users/me")
assert_status "'Token' 스키마 (Bearer 아님) → 401" 401 "$STATUS"

# ── 10. 다중 엔드포인트 접근 제어 ───────────────────────────────────��
echo ""
echo "▸ 10. 보호된 엔드포인트 접근 제어"
PROTECTED_ENDPOINTS=(
  "/api/users/me"
  "/api/research/"
  "/api/collections/"
  "/api/bookmarks/"
  "/api/billing/current"
)

for EP in "${PROTECTED_ENDPOINTS[@]}"; do
  STATUS=$(http_status "$BASE_URL$EP")
  assert_status "미인증 $EP → 401" 401 "$STATUS"
done

# ── 결과 요약 ────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo " 결과: $PASS/$TOTAL 통과, $FAIL 실패"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
