.PHONY: help build run test clean docker-build docker-run

help:
	@echo "Alert Service Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make build         Build the service"
	@echo "  make run           Run the service"
	@echo "  make test          Run tests"
	@echo "  make clean         Clean build artifacts"
	@echo "  make docker-build  Build Docker image"
	@echo "  make docker-run    Run in Docker"

build:
	@echo "Building alert-service..."
	@go build -o bin/alert-service cmd/main.go
	@echo "Build complete: bin/alert-service"

run:
	@echo "Running alert-service..."
	@go run cmd/main.go

test:
	@echo "Running tests..."
	@go test -v ./...

test-coverage:
	@echo "Running tests with coverage..."
	@go test -v -coverprofile=coverage.out ./...
	@go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

clean:
	@echo "Cleaning..."
	@rm -rf bin/
	@rm -f coverage.out coverage.html
	@echo "Clean complete"

lint:
	@echo "Running linter..."
	@golangci-lint run ./...

fmt:
	@echo "Formatting code..."
	@go fmt ./...

tidy:
	@echo "Tidying dependencies..."
	@go mod tidy

docker-build:
	@echo "Building Docker image..."
	@docker build -t alert-service:latest .

docker-run:
	@echo "Running in Docker..."
	@docker run -p 8083:8083 --env-file .env alert-service:latest

dev:
	@echo "Running with hot reload (requires air)..."
	@air

install-tools:
	@echo "Installing development tools..."
	@go install github.com/cosmtrek/air@latest
	@go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@echo "Tools installed"
