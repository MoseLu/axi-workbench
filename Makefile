.PHONY: help install dev build test clean lint type-check docker-up docker-down dev-web dev-admin dev-ui lint-fix dev-gateway dev-identity dev-platform dev-control-plane dev-auth dev-core dev-workflow dev-file dev-notification dev-kb dev-agent migrate-auth migrate-core migrate-identity migrate-platform migrate-workflow migrate-notification verify-go verify-specialists verify-helm verify-identity-mailpit

help:
	@echo "EPAP - Enterprise Project Automation Platform"
	@echo ""
	@echo "Available commands:"
	@echo "  make install        - Install all dependencies"
	@echo "  make dev            - Start all development servers"
	@echo "  make dev-web        - Start web portal dev server"
	@echo "  make dev-admin      - Start admin dashboard dev server"
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

dev-web:
	pnpm --filter web-portal dev

dev-admin:
	pnpm --filter admin-dashboard dev

dev-ui:
	pnpm --filter @epap/ui dev

build:
	pnpm turbo run build

test:
	pnpm turbo run test

lint:
	pnpm turbo run lint

lint-fix:
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

# Backend services. The dev-run scripts load the repository .env without
# printing secrets and apply the local ports/defaults used by Workbench.
dev-gateway:
	./services/api-gateway/scripts/dev-run.sh

dev-identity:
	./services/identity-adapter/scripts/dev-run.sh

dev-platform:
	./services/platform-core/scripts/dev-run.sh

dev-control-plane:
	./services/control-plane/scripts/dev-run.sh

dev-auth:
	cd services/auth-service && go run cmd/authserver/main.go

dev-core:
	cd services/core-service && ./gradlew bootRun

dev-workflow:
	cd services/workflow-engine && uv run --with-requirements requirements.txt uvicorn main:app --reload --host 0.0.0.0 --port 8083

dev-file:
	cd services/file-service && uv run --with-requirements requirements.txt uvicorn main:app --reload --host 0.0.0.0 --port 8085

dev-notification:
	cd services/notification-service && go run .

dev-kb:
	cd ai/knowledge-base && uv run fastapi dev src/api/main.py

dev-agent:
	cd ai/agent-platform && uv run fastapi dev src/api/main.py

# Database migrations
migrate-auth:
	cd services/auth-service && goose up

migrate-core:
	cd services/core-service && ./gradlew flywayMigrate

migrate-identity:
	cd services/identity-adapter && go run ./cmd/migrate

migrate-platform:
	cd services/platform-core && go run ./cmd/migrate

migrate-notification:
	cd services/notification-service && go run ./cmd/migrate

verify-go:
	cd services/api-gateway && go test -race ./...
	cd services/identity-adapter && go test -race ./...
	cd services/platform-core && go test -race ./...
	cd services/notification-service && go test -race ./...

verify-specialists:
	cd services/workflow-engine && uv run --with-requirements requirements-dev.txt pytest -q
	cd services/file-service && uv run --with-requirements requirements-dev.txt pytest -q
	cd services/notification-service && go test -race ./...

verify-helm:
	go run helm.sh/helm/v3/cmd/helm@v3.18.6 lint infra/helm/axi-workbench-platform --strict
	go run helm.sh/helm/v3/cmd/helm@v3.18.6 template axi-workbench infra/helm/axi-workbench-platform --namespace axi-workbench >/dev/null
	@! go run helm.sh/helm/v3/cmd/helm@v3.18.6 template axi-workbench infra/helm/axi-workbench-platform --set platformCore.outbox.workerEnabled=true >/dev/null 2>&1

verify-identity-mailpit:
	cd services/identity-adapter && IDENTITY_MAILPIT_SMTP_REQUIRED=1 go test -tags=integration ./internal/email -run TestMailpitSMTPDelivery -count=1

migrate-workflow:
	cd services/workflow-engine && alembic upgrade head
