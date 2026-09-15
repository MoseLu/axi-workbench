# Axi Workbench — Control Plane container image.
#
# Production-style multi-stage build, run from the monorepo root:
#   docker build -t axi-workbench/control-plane:local \
#     -f services/control-plane/Dockerfile .
#
# Stages:
#   1. build  — full pnpm install of the monorepo at the lockfile-pinned
#               version, then run `pnpm deploy` to produce a self-contained
#               /out/app tree with only production dependencies for the
#               control-plane package.
#   2. runtime — distroless Node 22, non-root, only the deployed /out/app.
#
# This image is intentionally separate from the API Gateway image: the
# Control Plane is a Node service on 8092, while the API Gateway is a
# Go service on 8080. Combining them would couple the Node runtime to
# the Gateway and break the per-service health / restart / resource-limit
# policy required by docs/deployment/REMOTE-WINDOWS-WORKBENCH-DEPLOYMENT-
# TODO.md §6 (方案 2：Control Plane 容器化).

# ----------------------------------------------------------------------------
# Stage 1 — dependency build
# ----------------------------------------------------------------------------
FROM node:22.13-bookworm-slim AS build
WORKDIR /src

# package.json pins the exact pnpm release (including its integrity hash).
# Let Corepack honor that pin instead of silently building with another 9.x.
RUN corepack enable

# Copy only manifests and the workspace declaration first so the install
# layer caches when only source code changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY services/control-plane/package.json ./services/control-plane/package.json

# Install the full workspace so `pnpm deploy` can resolve cross-package
# links. The deployed tree will strip devDependencies automatically.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --filter @axi/workstation-control-plane...

# Copy the rest of the source and produce a self-contained, production-only
# tree under /out/app.
COPY . .
RUN pnpm --filter @axi/workstation-control-plane deploy --prod /out/app

# ----------------------------------------------------------------------------
# Stage 2 — runtime (distroless Node 22, non-root)
# ----------------------------------------------------------------------------
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app

# /out/app contains the deployed package (its own package.json plus a
# pruned node_modules tree). Copying it in one shot keeps the runtime
# image as small as distroless + the app tree.
COPY --from=build /out/app /app

# Bind to 0.0.0.0 inside the container so the API Gateway (and the
# docker-compose healthcheck) can reach the service through the Compose
# network. The host-side `node src/server.mjs` default of 127.0.0.1 is
# preserved for local dev and is unaffected by this image.
ENV CONTROL_PLANE_BIND=0.0.0.0 \
    CONTROL_PLANE_PORT=8092 \
    NODE_ENV=production

EXPOSE 8092

USER nonroot:nonroot

# Distroless has no shell, so HEALTHCHECK is intentionally not declared
# here. The reverse proxy and docker-compose healthcheck probe /health
# over HTTP from outside the container.
ENTRYPOINT ["/nodejs/bin/node", "src/server.mjs"]
