FROM golang:1.26.7-alpine AS build
ENV GOPROXY=https://goproxy.cn,direct
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/notification-service .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/notification-migrate ./cmd/migrate

FROM alpine:3.22
RUN apk add --no-cache ca-certificates \
    && addgroup -S -g 65532 axi \
    && adduser -S -D -H -u 65532 -G axi axi
COPY --from=build /out/notification-service /notification-service
COPY --from=build /out/notification-migrate /notification-migrate
EXPOSE 8084
USER axi:axi
ENTRYPOINT ["/notification-service"]
