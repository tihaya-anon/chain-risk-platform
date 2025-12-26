FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git ca-certificates

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/bin/ingestion ./cmd/ingestion

# Runtime image
FROM alpine:3.19

WORKDIR /app

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates tzdata

# Copy binary
COPY --from=builder /app/bin/ingestion /app/ingestion
COPY --from=builder /app/configs /app/configs

# Create non-root user
RUN adduser -D -g '' appuser
USER appuser

EXPOSE 9091

ENTRYPOINT ["/app/ingestion"]
CMD ["-config", "/app/configs/config.yaml"]
