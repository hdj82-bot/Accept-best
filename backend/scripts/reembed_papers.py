"""papers.embedding 을 Gemini gemini-embedding-001 로 재생성하는 일회성 스크립트.

운영 매뉴얼:
    cutover 시각(기본 2026-04-08T09:20:08+09:00, 커밋 f4866da) 이전에 생성된
    papers 레코드는 OpenAI text-embedding-3-small 임베딩이고, 이후는 Gemini
    gemini-embedding-001 (output_dimensionality=1536) 이다. 양쪽 모두 1536차원
    이라 벡터만으로는 구분할 수 없으므로, 이 스크립트는 created_at 기준으로
    구식 임베딩 후보를 추려 재임베딩한다.

    실행은 반드시 backend/ 디렉토리에서 수행하고, DATABASE_URL/GEMINI_API_KEY
    가 환경에 로드된 상태여야 한다 (운영은 .env 또는 Render 환경변수). 기본은
    드라이런이며 실제 DB 쓰기는 --apply 가 명시될 때만 일어난다. 진행 상태는
    --state-file(기본 .reembed_state.json) 에 atomic-rename 으로 저장되어
    중단 후 같은 파일로 재실행하면 완료된 paper id 는 자동으로 건너뛴다.
    임베딩 생성 → UPDATE → commit 을 1건 단위로 수행하므로 부분 실패가
    누적되거나 트랜잭션이 오염되지 않는다.

사용 예:
    # 후보 개수/샘플 ID 확인 (드라이런)
    python -m scripts.reembed_papers --filter pre-cutover

    # 실제 적용
    python -m scripts.reembed_papers --filter pre-cutover --apply

    # 중단 후 이어서 실행 (같은 state-file 지정)
    python -m scripts.reembed_papers --filter pre-cutover --apply \
        --state-file .reembed_state.json
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

# 본 스크립트는 backend/ 를 PYTHONPATH로 두고 실행됨을 가정한다.
# (예: cd backend && python -m scripts.reembed_papers ...)
from app.models.database import async_session
from app.models.paper import Paper
from app.services.embedding_service import EMBEDDING_DIM, EMBEDDING_MODEL, create_embedding

# Gemini 전환 커밋 f4866da의 author date (KST). 이 시각 이전 created_at은 OpenAI 임베딩.
DEFAULT_CUTOVER_ISO = "2026-04-08T09:20:08+09:00"
DEFAULT_STATE_FILE = ".reembed_state.json"
DEFAULT_BATCH_SIZE = 50

logger = logging.getLogger("reembed")


# ---------------------------------------------------------------------------
# 상태 파일 (재시작 가능성)
# ---------------------------------------------------------------------------
@dataclass
class ReembedState:
    started_at: str
    cutover: str
    filter_mode: str
    completed_ids: set[str] = field(default_factory=set)
    failed_ids: dict[str, str] = field(default_factory=dict)  # id -> last error msg

    def to_json(self) -> dict:
        return {
            "started_at": self.started_at,
            "cutover": self.cutover,
            "filter_mode": self.filter_mode,
            "completed_ids": sorted(self.completed_ids),
            "failed_ids": self.failed_ids,
        }

    @classmethod
    def from_json(cls, data: dict) -> "ReembedState":
        return cls(
            started_at=data.get("started_at", ""),
            cutover=data.get("cutover", ""),
            filter_mode=data.get("filter_mode", ""),
            completed_ids=set(data.get("completed_ids", [])),
            failed_ids=dict(data.get("failed_ids", {})),
        )


def load_state(path: Path, *, cutover_iso: str, filter_mode: str) -> ReembedState:
    if not path.exists():
        return ReembedState(
            started_at=datetime.now(timezone.utc).isoformat(),
            cutover=cutover_iso,
            filter_mode=filter_mode,
        )
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    state = ReembedState.from_json(data)
    if state.cutover and state.cutover != cutover_iso:
        logger.warning(
            "state-file의 cutover(%s)와 인자 cutover(%s)가 다름. 인자 값으로 진행.",
            state.cutover,
            cutover_iso,
        )
        state.cutover = cutover_iso
    if state.filter_mode and state.filter_mode != filter_mode:
        logger.warning(
            "state-file의 filter(%s)와 인자 filter(%s)가 다름. 인자 값으로 진행.",
            state.filter_mode,
            filter_mode,
        )
        state.filter_mode = filter_mode
    return state


def save_state(path: Path, state: ReembedState) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(state.to_json(), f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


# ---------------------------------------------------------------------------
# 후보 조회
# ---------------------------------------------------------------------------
def _build_filter(filter_mode: str, cutover_dt: datetime):
    """filter_mode 별 SQLAlchemy where 절을 반환."""
    if filter_mode == "pre-cutover":
        # cutover 이전에 생성됐고 임베딩이 이미 있는 레코드 = OpenAI 임베딩 추정
        return (Paper.created_at < cutover_dt) & (Paper.embedding.is_not(None))
    if filter_mode == "null":
        # 임베딩이 비어 있는 레코드 (catch-up)
        return Paper.embedding.is_(None)
    if filter_mode == "all":
        # 모든 레코드 (제목/초록이 있어야 의미가 있으므로 하한 조건만 둠)
        return Paper.title.is_not(None)
    raise ValueError(f"unknown filter mode: {filter_mode}")


async def count_candidates(
    db: AsyncSession, filter_mode: str, cutover_dt: datetime
) -> int:
    where = _build_filter(filter_mode, cutover_dt)
    stmt = select(func.count()).select_from(Paper).where(where)
    return int((await db.execute(stmt)).scalar_one())


async def iter_candidate_batches(
    db: AsyncSession,
    *,
    filter_mode: str,
    cutover_dt: datetime,
    batch_size: int,
    skip_ids: set[str],
):
    """id 오름차순으로 배치 페이지네이션. (id > last_id) keyset 페이지네이션."""
    where = _build_filter(filter_mode, cutover_dt)
    last_id: str | None = None
    while True:
        stmt = (
            select(Paper.id, Paper.title, Paper.abstract)
            .where(where)
            .order_by(Paper.id)
            .limit(batch_size)
        )
        if last_id is not None:
            stmt = stmt.where(Paper.id > last_id)
        rows = (await db.execute(stmt)).all()
        if not rows:
            return
        last_id = rows[-1].id
        # 이미 완료된 id는 호출 측에서 건너뛰지만, 여기서도 미리 필터해 페이로드 축소.
        filtered = [r for r in rows if r.id not in skip_ids]
        if filtered:
            yield filtered


# ---------------------------------------------------------------------------
# 메인 루프
# ---------------------------------------------------------------------------
async def reembed_one(
    db: AsyncSession, paper_id: str, title: str, abstract: str | None
) -> int:
    """단일 paper 재임베딩 + commit. 반환: 임베딩 차원.

    API 실패가 트랜잭션을 오염시키지 않도록 임베딩 생성을 먼저 수행한 뒤
    UPDATE → commit 순으로 진행한다. 실패 시 호출 측에서 rollback.
    """
    text = f"{title} {abstract or ''}".strip()
    if not text:
        raise ValueError("empty text (title+abstract)")
    embedding = await create_embedding(text)  # network — DB 트랜잭션 밖
    if len(embedding) != EMBEDDING_DIM:
        raise ValueError(
            f"unexpected embedding dim: got {len(embedding)}, expected {EMBEDDING_DIM}"
        )
    await db.execute(
        update(Paper).where(Paper.id == paper_id).values(embedding=embedding)
    )
    await db.commit()
    return len(embedding)


async def run(
    *,
    filter_mode: str,
    cutover_iso: str,
    batch_size: int,
    apply: bool,
    state_path: Path,
    limit: int | None,
    save_every: int,
) -> int:
    cutover_dt = datetime.fromisoformat(cutover_iso)
    if cutover_dt.tzinfo is None:
        # naive datetime은 UTC로 가정
        cutover_dt = cutover_dt.replace(tzinfo=timezone.utc)

    state = load_state(state_path, cutover_iso=cutover_iso, filter_mode=filter_mode)

    mode_str = "APPLY" if apply else "DRY-RUN"
    logger.info("=" * 60)
    logger.info("reembed_papers — mode=%s filter=%s", mode_str, filter_mode)
    logger.info("model=%s dim=%d cutover=%s", EMBEDDING_MODEL, EMBEDDING_DIM, cutover_iso)
    logger.info("batch_size=%d state_file=%s limit=%s", batch_size, state_path, limit)
    logger.info(
        "이미 완료된 id %d개, 실패 기록 %d개 — 건너뜀",
        len(state.completed_ids),
        len(state.failed_ids),
    )
    logger.info("=" * 60)

    async with async_session() as db:
        total = await count_candidates(db, filter_mode, cutover_dt)
        remaining = total - len(state.completed_ids)
        logger.info("후보 총 %d건, 미완료 추정 %d건", total, remaining)

        if not apply:
            # 드라이런: 샘플 ID 몇 개만 보여주고 종료
            async for batch in iter_candidate_batches(
                db,
                filter_mode=filter_mode,
                cutover_dt=cutover_dt,
                batch_size=min(batch_size, 10),
                skip_ids=state.completed_ids,
            ):
                logger.info("[DRY-RUN] 샘플 후보 (최대 10건):")
                for row in batch[:10]:
                    title_preview = (row.title or "")[:60].replace("\n", " ")
                    logger.info("  - %s | %s", row.id, title_preview)
                break
            logger.info("[DRY-RUN] 종료. 실제 재임베딩하려면 --apply 추가.")
            return 0

        processed = 0
        ok = 0
        failed = 0

        async for batch in iter_candidate_batches(
            db,
            filter_mode=filter_mode,
            cutover_dt=cutover_dt,
            batch_size=batch_size,
            skip_ids=state.completed_ids,
        ):
            for row in batch:
                if limit is not None and ok >= limit:
                    logger.info("--limit %d 도달, 종료.", limit)
                    save_state(state_path, state)
                    return 0 if failed == 0 else 1

                processed += 1
                try:
                    dim = await reembed_one(db, row.id, row.title, row.abstract)
                    state.completed_ids.add(row.id)
                    state.failed_ids.pop(row.id, None)
                    ok += 1
                    logger.info(
                        "[%d/%d] ok  %s dim=%d", ok, remaining, row.id, dim
                    )
                except Exception as e:  # noqa: BLE001
                    # API 실패는 보통 commit 전이지만, UPDATE 후 commit 단계 실패
                    # 가능성도 있어 안전하게 rollback 후 다음 건으로 진행.
                    await db.rollback()
                    failed += 1
                    state.failed_ids[row.id] = f"{type(e).__name__}: {e}"[:500]
                    logger.warning(
                        "[%d/%d] FAIL %s: %s", processed, remaining, row.id, e
                    )

                if save_every and (ok + failed) % save_every == 0:
                    save_state(state_path, state)

            # 배치 경계마다 state 백업
            save_state(state_path, state)

        save_state(state_path, state)

        logger.info("=" * 60)
        logger.info("완료: ok=%d failed=%d processed=%d", ok, failed, processed)
        logger.info(
            "누적 완료 %d / 실패 %d. state=%s",
            len(state.completed_ids),
            len(state.failed_ids),
            state_path,
        )
        return 0 if failed == 0 else 1


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="reembed_papers",
        description="papers.embedding을 Gemini gemini-embedding-001로 재생성.",
    )
    p.add_argument(
        "--filter",
        dest="filter_mode",
        choices=("pre-cutover", "null", "all"),
        default="pre-cutover",
        help=(
            "재임베딩 대상. 'pre-cutover' (기본): cutover 이전 생성 + 임베딩 있는 레코드. "
            "'null': 임베딩이 비어 있는 레코드. 'all': 모든 레코드(주의)."
        ),
    )
    p.add_argument(
        "--cutover",
        default=DEFAULT_CUTOVER_ISO,
        help=f"OpenAI→Gemini 전환 시각 (ISO8601). 기본 {DEFAULT_CUTOVER_ISO}",
    )
    p.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=(
            f"DB 페이지네이션 단위 (기본 {DEFAULT_BATCH_SIZE}). commit은 1건마다."
        ),
    )
    p.add_argument(
        "--apply",
        action="store_true",
        help="실제 DB 쓰기 수행. 기본은 드라이런.",
    )
    p.add_argument(
        "--state-file",
        default=DEFAULT_STATE_FILE,
        help=f"진행 상태 JSON 경로 (기본 {DEFAULT_STATE_FILE}). 같은 파일을 다시 지정하면 이어서 실행.",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=None,
        help="이번 실행에서 성공 처리할 최대 건수 (테스트용).",
    )
    p.add_argument(
        "--save-every",
        type=int,
        default=20,
        help="N건마다 state-file을 저장 (기본 20). 0 이면 배치 단위만.",
    )
    p.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="DEBUG 로그.",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )
    try:
        return asyncio.run(
            run(
                filter_mode=args.filter_mode,
                cutover_iso=args.cutover,
                batch_size=max(1, args.batch_size),
                apply=args.apply,
                state_path=Path(args.state_file),
                limit=args.limit,
                save_every=max(0, args.save_every),
            )
        )
    except KeyboardInterrupt:
        logger.warning("중단(SIGINT). state-file까지 저장된 진행분은 유지됨.")
        return 130


if __name__ == "__main__":
    sys.exit(main())
