FROM golang:1.26.7-alpine AS build
ENV GOPROXY=https://goproxy.cn,direct
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/api-gateway ./cmd/gateway

FROM alpine:3.22
RUN apk add --no-cache ca-certificates \
    && addgroup -S -g 65532 axi \
    && adduser -S -D -H -u 65532 -G axi axi
COPY --from=build /out/api-gateway /api-gateway
COPY --from=build /src/config/routes.yaml /config/routes.yaml
EXPOSE 8080
USER axi:axi
ENTRYPOINT ["/api-gateway"]
