.PHONY: help install dev build test clean lint type-check docker-up docker-down

help:
	@echo "EPAP - Enterprise Project Automation Platform"
	@echo ""
	@echo "Available commands:"
	@echo "  make install        - Install all dependencies"
	@echo "  make dev            - Start all development servers"
	@echo "  make dev:web        - Start web portal dev server"
	@echo "  make dev:admin      - Start admin dashboard dev server"
	@echo "  make build          - Build all packages and apps"
	@echo "  make test           - Run all tests"
	@echo "  make lint           - Run linting"
	@echo "  make type-check     - Run type checking"
	@echo "  make clean          - Clean all build artifacts"
	@echo "  make docker-up      - Start local infrastructure"
	@echo "  make docker-down   - Stop local infrastructure"
	@echo ""

install:
	pnpm install

dev:
	pnpm turbo run dev --parallel

dev:web:
	pnpm --filter web-portal dev

dev:admin:
	pnpm --filter admin-dashboard dev

dev:ui:
	pnpm --filter @epap/ui dev

build:
	pnpm turbo run build

test:
	pnpm turbo run test

lint:
	pnpm turbo run lint

lint:fix:
	pnpm turbo run lint -- --fix

type-check:
	pnpm turbo run type-check

clean:
	pnpm turbo run clean
	rm -rf node_modules
	rm -rf .turbo

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

# Backend services
dev:gateway:
	cd services/api-gateway && go run cmd/gateway/main.go

dev:auth:
	cd services/auth-service && go run cmd/authserver/main.go

dev:core:
	cd services/core-service && ./gradlew bootRun

dev:workflow:
	cd services/workflow-engine && uv run fastapi dev src/api/main.py

dev:kb:
	cd ai/knowledge-base && uv run fastapi dev src/api/main.py

dev:agent:
	cd ai/agent-platform && uv run fastapi dev src/api/main.py

# Database migrations
migrate:auth:
	cd services/auth-service && goose up

migrate:core:
	cd services/core-service && ./gradlew flywayMigrate

migrate:workflow:
	cd services/workflow-engine && alembic upgrade head
