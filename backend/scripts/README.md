# backend/scripts/

일회성 운영 스크립트 모음. 모든 스크립트는 `backend/` 디렉토리에서 모듈 형태로
실행하며 (`python -m scripts.<name>`), DB 쓰기를 동반하는 스크립트는 기본적으로
드라이런으로 동작하고 `--apply` 플래그가 있을 때만 실제 변경을 수행한다.

## 인덱스

| 스크립트 | 용도 | 상태 |
|---|---|---|
| [reembed_papers.py](reembed_papers.py) | 4/8 Gemini 전환 이전 OpenAI 임베딩 레코드를 재임베딩 | active (1회성) |

## 공통 실행 규칙

- 실행 위치: `backend/`
- 환경변수: `DATABASE_URL`, `GEMINI_API_KEY` 등 운영 .env 또는 Render 환경에 따름
- 기본은 드라이런. 실제 적용은 `--apply` 명시 후 다시 실행
- 상태/체크포인트가 있는 스크립트는 `--state-file` 으로 동일 경로를 다시 지정해
  중단 지점부터 이어서 실행 가능

## reembed_papers.py 요약

```bash
cd backend

# 1) 후보 확인 (드라이런 — 안전, DB 변경 없음)
python -m scripts.reembed_papers --filter pre-cutover

# 2) 실제 재임베딩
python -m scripts.reembed_papers --filter pre-cutover --apply

# 3) 중단 후 재시작
python -m scripts.reembed_papers --filter pre-cutover --apply \
    --state-file .reembed_state.json
```

- 컷오버 기본값: `2026-04-08T09:20:08+09:00` (Gemini 전환 커밋 f4866da)
- 필터 모드: `pre-cutover` (기본·OpenAI 추정분) / `null` (임베딩 비어있는 catch-up) / `all` (주의)
- 실패 시 트랜잭션은 1건 단위로 rollback 되고 `failed_ids` 에 사유가 남는다
- 임베딩 차원이 1536 이 아니면 거부 (모델/차원 가드)
