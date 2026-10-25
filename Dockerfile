# syntax=docker/dockerfile:1

# ---- build: install, test, compile everything into one self-contained binary ----
FROM oven/bun:1.4.4 AS build
WORKDIR /src
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun test && bun run build \
	&& mkdir -p /out/data

# ---- runtime: distroless (glibc, no shell), runs as non-root (uid 65532) ----
FROM gcr.io/distroless/cc-debian13:nonroot
WORKDIR /app
COPY --from=build /src/dist/cms /app/cms
# owned by the runtime user, so a fresh named volume mounted here inherits the permissions
COPY --from=build --chown=65532:65532 /out/data /app/data

ENV NODE_ENV=production \
	PORT=3000 \
	HOST=0.0.0.0 \
	DATA_DIR=/app/data

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["/app/cms", "--health"]
ENTRYPOINT ["/app/cms"]
