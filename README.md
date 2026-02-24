# Enterprise Project Automation Platform (EPAP)

> AI-powered enterprise project management and automation platform

## Overview

EPAP is a full-stack automation platform for enterprise software development scenarios. It combines **multiple frontends**, **multiple backends**, and **AI collaboration** in a unified Monorepo workspace to manage projects, workflows, knowledge bases, and intelligent agents.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite + Turborepo + Taro + Zod |
| Backend | Go (Gateway/Auth) · Java Spring Boot (Core) · Python FastAPI (AI/Workflow) |
| AI | LangChain · Qdrant · Anthropic Claude · RAG · Multi-Agent |
| Infrastructure | PostgreSQL · Redis · Kafka · MinIO · Kubernetes · Terraform |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Apps                             │
│  ┌──────────────┐ ┌────────────────┐ ┌────────┐ ┌───────────┐  │
│  │  web-portal │ │ admin-dashboard│ │ mobile │ │design-sys │  │
│  └──────────────┘ └────────────────┘ └────────┘ └───────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                       Shared Packages                            │
│  ┌────────┐ ┌──────┐ ┌──────┐ ┌──────────┐ ┌──────┐           │
│  │schemas │ │ types│ │ utils│ │api-client│ │  ui   │           │
│  └────────┘ └──────┘ └──────┘ └──────────┘ └──────┘           │
├─────────────────────────────────────────────────────────────────┐
│                        Backend Services                          │
│  ┌────────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐   │
│  │api-gateway │ │auth-srv   │ │core-srv   │ │workflow-eng  │   │
│  └────────────┘ └───────────┘ └───────────┘ └───────────────┘   │
│  ┌────────────────┐ ┌────────────┐                                │
│  │notification-srv│ │file-service│                                │
│  └────────────────┘ └────────────┘                                │
├─────────────────────────────────────────────────────────────────┤
│                         AI Layer                                 │
│  ┌─────────────────┐ ┌─────────────────┐                        │
│  │  knowledge-base │ │  agent-platform │                        │
│  │     (RAG)      │ │    (Multi-Agent)│                        │
│  └─────────────────┘ └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
enterprise-project-automation-platform/
├── apps/                    # Frontend applications
│   ├── web-portal/         # Main web portal
│   ├── admin-dashboard/   # Admin dashboard
│   ├── mobile-app/        # Mobile app (Taro)
│   └── design-system/     # Component library
├── packages/               # Shared packages
│   ├── schemas/           # Zod schemas
│   ├── types/             # TypeScript types
│   ├── utils/             # Utility functions
│   ├── api-client/        # API client
│   └── ui/                # UI component library
├── services/              # Backend services
│   ├── api-gateway/       # Go API gateway
│   ├── auth-service/      # Go authentication
│   ├── core-service/      # Java Spring Boot
│   ├── workflow-engine/   # Python FastAPI
│   ├── notification-srv/  # Go notifications
│   └── file-service/      # Python file service
├── ai/                    # AI capabilities
│   ├── knowledge-base/    # RAG knowledge base
│   └── agent-platform/   # Agent platform
├── docs/                  # Architecture documentation
├── docker-compose.yml     # Local development environment
├── turbo.json            # Turborepo configuration
└── pnpm-workspace.yaml   # PNPM workspace configuration
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PNPM >= 8.0.0
- Docker & Docker Compose
- Go (for backend services)
- Java 17+ (for core-service)
- Python 3.10+ (for AI services)

### Installation

```bash
# Install dependencies
pnpm install

# Generate API types (after schemas are defined)
pnpm run build:schemas
```

### Development

```bash
# Start all services in development mode
pnpm run dev

# Start specific app
pnpm run dev:web

# Start admin dashboard
pnpm run dev:admin

# Start with Docker (infrastructure only)
docker-compose up -d

# Run tests
pnpm run test

# Lint code
pnpm run lint
```

### Build

```bash
# Build all packages and apps
pnpm run build

# Build specific package
pnpm run build:schemas
pnpm run build:types
pnpm run build:utils
pnpm run build:api-client
```

## Services Ports

| Service | Port |
|---------|------|
| api-gateway | 8080 |
| auth-service | 8081 |
| core-service | 8082 |
| workflow-engine | 8083 |
| notification-service | 8084 |
| file-service | 8085 |
| knowledge-base | 8090 |
| agent-platform | 8091 |
| web-portal (dev) | 5173 |
| admin-dashboard (dev) | 5174 |
| Storybook | 6006 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Qdrant | 6333 |
| Kafka | 9092 |
| Grafana | 3001 |

## Documentation

For detailed architecture documentation, see the [docs](./docs) folder:

- [Overview](./docs/01-overview.md) - Platform introduction and design principles
- [Architecture](./docs/02-architecture.md) - System architecture and data flow
- [Frontend](./docs/03-frontend.md) - Frontend applications and shared packages
- [Backend](./docs/04-backend.md) - Backend services detailed design
- [AI Layer](./docs/05-ai-layer.md) - RAG and Agent platforms
- [Infrastructure](./docs/06-infrastructure.md) - DevOps, K8s, CI/CD

## Contributing

1. Follow the existing code style and conventions
2. Ensure TypeScript types are properly defined
3. Write tests for new features
4. Update documentation when needed

## License

Private - All rights reserved
