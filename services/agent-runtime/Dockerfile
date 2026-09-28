# services/agent-runtime/Dockerfile
#
# Minimal Node 22 image for agent-runtime. The image only needs node + the
# codex CLI binary; agent-runtime itself owns the ONLY spawn codex call site
# in the workbench monorepo (see services/agent-runtime/src/runtime.mjs).

FROM node:22.5.0-bookworm-slim

ENV NODE_ENV=production \
    AXI_AGENT_RUNTIME_PORT=8094 \
    AXI_AGENT_RUNTIME_HOST=127.0.0.1

WORKDIR /app

COPY package.json ./
COPY src ./src

EXPOSE 8094

# Health check uses the same /healthz endpoint control-plane will hit.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.AXI_AGENT_RUNTIME_PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.mjs"]
