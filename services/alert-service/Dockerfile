# Build stage
FROM golang:1.23-alpine AS builder
WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download && go mod tidy

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /alert-service ./cmd/...

# Runtime stage
FROM alpine:3.19
WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata && \
    adduser -D -u 1000 appuser

COPY --from=builder /alert-service /usr/local/bin/
COPY configs/config.yaml /app/configs/

USER appuser

EXPOSE 8083

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8083/health || exit 1

ENTRYPOINT ["alert-service"]
