FROM golang:1.26.7-alpine AS build
ENV GOPROXY=https://goproxy.cn,direct
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/identity-adapter ./cmd/identity-adapter
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/identity-migrate ./cmd/migrate

FROM alpine:3.22
RUN apk add --no-cache ca-certificates \
    && addgroup -S -g 65532 axi \
    && adduser -S -D -H -u 65532 -G axi axi
COPY --from=build /out/identity-adapter /identity-adapter
COPY --from=build /out/identity-migrate /identity-migrate
EXPOSE 8081
USER axi:axi
ENTRYPOINT ["/identity-adapter"]
