from __future__ import annotations

import logging
from typing import Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)


# ── HTML 템플릿 ────────────────────────────────────────────────────────────────

def render_plan_expiry_warning(user_email: str, plan: str, days_left: int) -> str:
    return f"""
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><title>플랜 만료 안내</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1a1a2e">📋 플랜 만료 안내</h2>
  <p>안녕하세요,</p>
  <p>현재 이용 중인 <strong>{plan}</strong> 플랜이 <strong>{days_left}일 후</strong> 만료될 예정입니다.</p>
  <p>만료 후에는 무료 플랜으로 자동 전환되어 일부 기능이 제한됩니다.</p>
  <a href="https://academi.ai/billing"
     style="display:inline-block;margin-top:16px;padding:12px 24px;
            background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px">
    플랜 갱신하기
  </a>
  <p style="margin-top:32px;color:#666;font-size:12px">
    이 메일은 {user_email} 계정으로 발송되었습니다.
  </p>
</body>
</html>
""".strip()


def render_research_complete(
    user_email: str, note_title: str, export_url: str
) -> str:
    return f"""
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><title>연구 노트 완성</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1a1a2e">✅ 연구 노트 내보내기 완료</h2>
  <p>안녕하세요,</p>
  <p><strong>{note_title}</strong> 노트의 내보내기가 완료되었습니다.</p>
  <a href="{export_url}"
     style="display:inline-block;margin-top:16px;padding:12px 24px;
            background:#059669;color:#fff;text-decoration:none;border-radius:6px">
    파일 다운로드
  </a>
  <p style="margin-top:8px;color:#999;font-size:12px">
    링크는 1시간 후 만료됩니다.
  </p>
  <p style="margin-top:32px;color:#666;font-size:12px">
    이 메일은 {user_email} 계정으로 발송되었습니다.
  </p>
</body>
</html>
""".strip()


def render_payment_complete(user_email: str, plan: str, amount: int) -> str:
    plan_label = {"basic": "Basic", "pro": "Pro"}.get(plan, plan)
    amount_str = f"₩{amount:,}"
    return f"""
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><title>결제 완료</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1a1a2e">✅ 결제가 완료되었습니다</h2>
  <p>안녕하세요,</p>
  <p><strong>{plan_label}</strong> 플랜 결제({amount_str})가 정상적으로 처리되었습니다.</p>
  <a href="https://academi.ai/dashboard"
     style="display:inline-block;margin-top:16px;padding:12px 24px;
            background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px">
    대시보드로 이동
  </a>
  <p style="margin-top:32px;color:#666;font-size:12px">
    이 메일은 {user_email} 계정으로 발송되었습니다.
  </p>
</body>
</html>
""".strip()


# ── 발송 ──────────────────────────────────────────────────────────────────────

def send_email(to: str, subject: str, html_body: str) -> None:
    settings = get_settings()

    if settings.use_fixtures:
        logger.info(
            "[email fixture] to=%s subject=%s (not sent)", to, subject
        )
        return

    import boto3  # noqa: PLC0415

    client = boto3.client(
        "ses",
        region_name="ap-northeast-2",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    client.send_email(
        Source="no-reply@academi.ai",
        Destination={"ToAddresses": [to]},
        Message={
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {"Html": {"Data": html_body, "Charset": "UTF-8"}},
        },
    )
    logger.info("email sent to=%s subject=%s", to, subject)
