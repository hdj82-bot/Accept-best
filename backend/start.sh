#!/bin/bash
set -e

# DB 마이그레이션 실행
echo "Running database migrations..."
alembic upgrade head

# FastAPI 서버 시작
echo "Starting FastAPI server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
