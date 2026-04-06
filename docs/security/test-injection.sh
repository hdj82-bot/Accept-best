#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# SQL Injection & XSS 페이로드 테스트 스크립트
#
# 대상: academi.ai API — 검색, 컬렉션 생성 등 사용자 입력 엔드포인트
# 사용: ./test-injection.sh https://api.academi.ai <VALID_JWT>
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

SAFE_CODES="200|400|401|403|404|422|429"

check_safe() {
  local desc="$1" status="$2" body="$3"
  if echo "$status" | grep -qE "^($SAFE_CODES)$"; then
    if echo "$body" | grep -qiE "syntax error|pg_sleep|unterminated|column.*does not exist|relation.*does not exist"; then
      fail "$desc" "HTTP $status이지만 응답에 DB 에러 흔적 존재"
    else
      pass "$desc (HTTP $status)"
    fi
  elif [ "$status" = "500" ]; then
    fail "$desc" "HTTP 500 — 서버 에러 (injection 가능성)"
  else
    fail "$desc" "예상 외 응답: HTTP $status"
  fi
}

echo "============================================"
echo " SQL Injection & XSS 보안 테스트"
echo " 대상: $BASE_URL"
echo "============================================"

# ══════════════════════════════════════════════════════════════════════
# PART 1: SQL Injection
# ══════════════════════════════════════════════════════════════════════
echo ""
echo "═══ PART 1: SQL Injection ═══"

SQLI_PAYLOADS=(
  "' OR 1=1--"
  "\" OR 1=1--"
  "'; DROP TABLE users;--"
  "1' UNION SELECT null,null,null--"
  "1; SELECT pg_sleep(5);--"
  "' AND 1=CONVERT(int,(SELECT @@version))--"
  "admin'--"
  "1' OR '1'='1"
  "' WAITFOR DELAY '0:0:5'--"
  "1'; EXEC xp_cmdshell('id');--"
)

# ── 1.1 검색 쿼리 파라미터 ───────────────────────────────────────────
echo ""
echo "▸ 1.1 논문 검색 (GET query param)"

for payload in "${SQLI_PAYLOADS[@]}"; do
  ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$payload'''))" 2>/dev/null || echo "$payload")
  RESP=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    "$BASE_URL/api/papers/search?query=$ENCODED")
  BODY=$(echo "$RESP" | head -n -1)
  STATUS=$(echo "$RESP" | tail -n1)
  check_safe "검색 SQLi: $payload" "$STATUS" "$BODY"
done

# ── 1.2 검색 POST body ──────────────────────────────────────────────
echo ""
echo "▸ 1.2 논문 검색 (POST body)"

for payload in "${SQLI_PAYLOADS[@]}"; do
  RESP=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/papers/search" \
    -d "{\"query\":\"$payload\"}")
  BODY=$(echo "$RESP" | head -n -1)
  STATUS=$(echo "$RESP" | tail -n1)
  check_safe "검색 POST SQLi: ${payload:0:40}" "$STATUS" "$BODY"
done

# ── 1.3 컬렉션 이름 ─────────────────────────────────────────────────
echo ""
echo "▸ 1.3 컬렉션 생성 (name 필드)"

for payload in "${SQLI_PAYLOADS[@]}"; do
  RESP=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/collections/" \
    -d "{\"name\":\"$payload\",\"description\":\"test\"}")
  BODY=$(echo "$RESP" | head -n -1)
  STATUS=$(echo "$RESP" | tail -n1)
  check_safe "컬렉션 SQLi: ${payload:0:40}" "$STATUS" "$BODY"
done

# ── 1.4 사용자 이름 업데이트 ─────────────────────────────────────────
echo ""
echo "▸ 1.4 사용자 이름 (PATCH /api/users/me)"

for payload in "' OR 1=1--" "'; DROP TABLE users;--" "1' UNION SELECT null--"; do
  RESP=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -X PATCH "$BASE_URL/api/users/me" \
    -d "{\"name\":\"$payload\"}")
  BODY=$(echo "$RESP" | head -n -1)
  STATUS=$(echo "$RESP" | tail -n1)
  check_safe "사용자명 SQLi: ${payload:0:40}" "$STATUS" "$BODY"
done

# ── 1.5 Time-based blind injection ──────────────────────────────────
echo ""
echo "▸ 1.5 Time-based blind SQLi (응답 시간 측정)"

NORMAL_TIME=$(curl -s -o /dev/null -w "%{time_total}" \
  -H "Authorization: Bearer $JWT" \
  "$BASE_URL/api/papers/search?query=normal")

INJECT_TIME=$(curl -s -o /dev/null -w "%{time_total}" \
  -H "Authorization: Bearer $JWT" \
  "$BASE_URL/api/papers/search?query=test'%3B+SELECT+pg_sleep(5)%3B--")

SLOW=$(python3 -c "print('YES' if float('$INJECT_TIME') > float('$NORMAL_TIME') + 4.0 else 'NO')" 2>/dev/null || echo "NO")

if [ "$SLOW" = "NO" ]; then
  pass "pg_sleep blind injection 미동작 (정상: ${NORMAL_TIME}s, 주입: ${INJECT_TIME}s)"
else
  fail "pg_sleep blind injection 의심" "정상: ${NORMAL_TIME}s, 주입: ${INJECT_TIME}s (4초 이상 차이)"
fi

# ══════════════════════════════════════════════════════════════════════
# PART 2: XSS (Cross-Site Scripting)
# ══════════════════════════════════════════════════════════════════════
echo ""
echo "═══ PART 2: XSS ═══"

XSS_PAYLOADS=(
  '<script>alert(1)</script>'
  '<img src=x onerror=alert(1)>'
  '"><svg/onload=alert(1)>'
  "javascript:alert(1)"
  '<iframe src="javascript:alert(1)">'
  '<body onload=alert(1)>'
  '<details open ontoggle=alert(1)>'
)

# ── 2.1 검색 결과 Reflected XSS ─────────────────────────────────────
echo ""
echo "▸ 2.1 검색 Reflected XSS"

for payload in "${XSS_PAYLOADS[@]}"; do
  ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$payload'''))" 2>/dev/null || echo "$payload")
  RESP=$(curl -s \
    -H "Authorization: Bearer $JWT" \
    "$BASE_URL/api/papers/search?query=$ENCODED")

  if echo "$RESP" | grep -qF "$payload"; then
    fail "Reflected XSS: ${payload:0:40}" "페이로드가 응답에 그대로 반사됨"
  else
    pass "Reflected XSS 차단: ${payload:0:40}"
  fi
done

# ── 2.2 Stored XSS (컬렉션 이름) ────────────────────────────────────
echo ""
echo "▸ 2.2 Stored XSS — 컬렉션 이름"

for payload in '<script>alert(1)</script>' '<img src=x onerror=alert(1)>'; do
  CREATE_RESP=$(curl -s \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/collections/" \
    -d "{\"name\":\"$payload\",\"description\":\"xss-test\"}")

  COL_ID=$(echo "$CREATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

  if [ -n "$COL_ID" ]; then
    LIST_RESP=$(curl -s -H "Authorization: Bearer $JWT" "$BASE_URL/api/collections/")
    if echo "$LIST_RESP" | grep -qF "$payload"; then
      fail "Stored XSS: ${payload:0:40}" "페이로드가 이스케이프 없이 저장/반환됨"
    else
      pass "Stored XSS sanitized: ${payload:0:40}"
    fi
    curl -s -o /dev/null -H "Authorization: Bearer $JWT" \
      -X DELETE "$BASE_URL/api/collections/$COL_ID" 2>/dev/null || true
  else
    pass "Stored XSS: ${payload:0:40} (생성 거부됨 — 안전)"
  fi
done

# ── 2.3 보안 헤더 확인 ───────────────────────────────────────────────
echo ""
echo "▸ 2.3 보안 응답 헤더"

HEADERS=$(curl -s -I -H "Authorization: Bearer $JWT" "$BASE_URL/api/users/me")

check_header() {
  local name="$1" expected="$2"
  if echo "$HEADERS" | grep -qi "$name"; then
    pass "헤더 존재: $name"
  else
    fail "헤더 누락: $name" "expected: $expected"
  fi
}

check_header "X-Content-Type-Options" "nosniff"
check_header "X-Frame-Options" "DENY"

# ══════════════════════════════════════════════════════════════════════
# PART 3: Path Traversal
# ══════════════════════════════════════════════════════════════════════
echo ""
echo "═══ PART 3: Path Traversal ═══"

TRAVERSAL_PATHS=(
  "/api/export/markdown/../../etc/passwd"
  "/api/export/markdown/..%2F..%2Fetc%2Fpasswd"
  "/api/research/%2e%2e%2f%2e%2e%2fetc%2fpasswd"
)

for path in "${TRAVERSAL_PATHS[@]}"; do
  RESP=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    "$BASE_URL$path")
  BODY=$(echo "$RESP" | head -n -1)
  STATUS=$(echo "$RESP" | tail -n1)
  if echo "$BODY" | grep -q "root:"; then
    fail "Path traversal: $path" "파일 시스템 접근 가능"
  else
    pass "Path traversal 차단: ${path:0:50} (HTTP $STATUS)"
  fi
done

# ── 결과 요약 ────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo " 결과: $PASS/$TOTAL 통과, $FAIL 실패"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
