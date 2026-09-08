FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/identity-adapter ./cmd/identity-adapter
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/identity-migrate ./cmd/migrate

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/identity-adapter /identity-adapter
COPY --from=build /out/identity-migrate /identity-migrate
EXPOSE 8081
USER nonroot:nonroot
ENTRYPOINT ["/identity-adapter"]
