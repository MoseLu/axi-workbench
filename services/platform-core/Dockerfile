FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/platform-core ./cmd/platform-core
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/platform-migrate ./cmd/migrate

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/platform-core /platform-core
COPY --from=build /out/platform-migrate /platform-migrate
EXPOSE 8082
USER nonroot:nonroot
ENTRYPOINT ["/platform-core"]
