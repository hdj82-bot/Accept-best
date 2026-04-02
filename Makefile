.PHONY: up down dev migrate test logs shell-be shell-db seed

up:
	docker compose up -d

down:
	docker compose down

dev:
	docker compose -f docker-compose.yml -f docker-compose.override.yml up

migrate:
	docker compose exec backend alembic upgrade head

test:
	docker compose exec backend pytest -v

logs:
	docker compose logs -f $(s)

shell-be:
	docker compose exec backend bash

shell-db:
	docker compose exec db psql -U academi -d academi

seed:
	docker compose exec backend python -m app.scripts.seed
