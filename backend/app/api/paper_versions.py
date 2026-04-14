from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user
from app.schemas.paper_version import (
    PaperVersionCreate,
    PaperVersionListResponse,
    PaperVersionRead,
)
from app.services.paper_version_service import (
    delete_version,
    get_version,
    list_versions,
    save_version,
)

router = APIRouter(prefix="/versions", tags=["versions"])


@router.post("", response_model=PaperVersionRead)
async def create_version(
    req: PaperVersionCreate,
    user_id: str = Depends(get_current_user),
):
    """논문 버전을 저장한다."""
    version = await save_version(req, user_id)
    return PaperVersionRead.model_validate(version.__dict__)


@router.get("", response_model=PaperVersionListResponse)
async def read_versions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user),
):
    """논문 버전 목록을 조회한다."""
    versions, total = await list_versions(limit=limit, offset=offset)
    return PaperVersionListResponse(
        versions=[PaperVersionRead.model_validate(v.__dict__) for v in versions],
        total=total,
    )


@router.get("/{version_id}", response_model=PaperVersionRead)
async def read_version(
    version_id: str,
    user_id: str = Depends(get_current_user),
):
    """논문 버전 상세 정보를 조회한다."""
    version = await get_version(version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return PaperVersionRead.model_validate(version.__dict__)


@router.delete("/{version_id}")
async def remove_version(
    version_id: str,
    user_id: str = Depends(get_current_user),
):
    """논문 버전을 삭제한다. manual 타입만 삭제 가능."""
    version = await get_version(version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    if version.version_type == "auto":
        raise HTTPException(status_code=400, detail="자동 저장 버전은 삭제할 수 없습니다")
    await delete_version(version_id)
    return {"message": "삭제되었습니다"}
