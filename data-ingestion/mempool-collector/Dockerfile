FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache gcc musl-dev

COPY go.mod go.sum* ./
RUN go mod download || true

COPY . .

RUN CGO_ENABLED=1 go build -ldflags="-s -w" -o /mempool-collector ./cmd

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /mempool-collector .
COPY configs/config.docker.yaml ./configs/config.yaml

EXPOSE 9090 9091

ENTRYPOINT ["/app/mempool-collector"]
CMD ["-config", "/app/configs/config.yaml"]
