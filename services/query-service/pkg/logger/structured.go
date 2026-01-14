package logger

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"time"

	"go.opentelemetry.io/otel/trace"
)

// Level represents log severity.
type Level string

const (
	LevelDebug Level = "DEBUG"
	LevelInfo  Level = "INFO"
	LevelWarn  Level = "WARN"
	LevelError Level = "ERROR"
)

// LogEntry represents a structured log entry.
type LogEntry struct {
	Timestamp   string                 `json:"timestamp"`
	Level       Level                  `json:"level"`
	Service     string                 `json:"service"`
	TraceID     string                 `json:"trace_id,omitempty"`
	SpanID      string                 `json:"span_id,omitempty"`
	Message     string                 `json:"message"`
	DurationMs  float64                `json:"duration_ms,omitempty"`
	Error       string                 `json:"error,omitempty"`
	Fields      map[string]interface{} `json:"fields,omitempty"`
}

// Logger provides structured JSON logging with trace correlation.
type Logger struct {
	service string
	output  io.Writer
	level   Level
}

// New creates a new structured logger.
func New(service string) *Logger {
	return &Logger{
		service: service,
		output:  os.Stdout,
		level:   LevelInfo,
	}
}

// SetOutput sets the log output destination.
func (l *Logger) SetOutput(w io.Writer) {
	l.output = w
}

// SetLevel sets the minimum log level.
func (l *Logger) SetLevel(level Level) {
	l.level = level
}

// Debug logs a debug message.
func (l *Logger) Debug(ctx context.Context, msg string, fields map[string]interface{}) {
	if l.shouldLog(LevelDebug) {
		l.log(ctx, LevelDebug, msg, fields)
	}
}

// Info logs an info message.
func (l *Logger) Info(ctx context.Context, msg string, fields map[string]interface{}) {
	if l.shouldLog(LevelInfo) {
		l.log(ctx, LevelInfo, msg, fields)
	}
}

// Warn logs a warning message.
func (l *Logger) Warn(ctx context.Context, msg string, fields map[string]interface{}) {
	if l.shouldLog(LevelWarn) {
		l.log(ctx, LevelWarn, msg, fields)
	}
}

// Error logs an error message.
func (l *Logger) Error(ctx context.Context, msg string, err error, fields map[string]interface{}) {
	if l.shouldLog(LevelError) {
		if fields == nil {
			fields = make(map[string]interface{})
		}
		errMsg := ""
		if err != nil {
			errMsg = err.Error()
		}
		entry := l.createEntry(ctx, LevelError, msg, fields)
		entry.Error = errMsg
		l.write(entry)
	}
}

// WithDuration logs with duration measurement.
func (l *Logger) WithDuration(ctx context.Context, level Level, msg string, durationMs float64, fields map[string]interface{}) {
	if l.shouldLog(level) {
		entry := l.createEntry(ctx, level, msg, fields)
		entry.DurationMs = durationMs
		l.write(entry)
	}
}

func (l *Logger) log(ctx context.Context, level Level, msg string, fields map[string]interface{}) {
	entry := l.createEntry(ctx, level, msg, fields)
	l.write(entry)
}

func (l *Logger) createEntry(ctx context.Context, level Level, msg string, fields map[string]interface{}) LogEntry {
	entry := LogEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Level:     level,
		Service:   l.service,
		Message:   msg,
		Fields:    fields,
	}

	// Extract trace context if available
	spanCtx := trace.SpanContextFromContext(ctx)
	if spanCtx.IsValid() {
		entry.TraceID = spanCtx.TraceID().String()
		entry.SpanID = spanCtx.SpanID().String()
	}

	return entry
}

func (l *Logger) write(entry LogEntry) {
	data, err := json.Marshal(entry)
	if err != nil {
		return
	}
	l.output.Write(append(data, '\n'))
}

func (l *Logger) shouldLog(level Level) bool {
	levels := map[Level]int{
		LevelDebug: 0,
		LevelInfo:  1,
		LevelWarn:  2,
		LevelError: 3,
	}
	return levels[level] >= levels[l.level]
}

// Global logger instance
var defaultLogger = New("query-service")

// SetDefault sets the default logger service name.
func SetDefault(service string) {
	defaultLogger = New(service)
}

// Global logging functions
func Debug(ctx context.Context, msg string, fields map[string]interface{}) {
	defaultLogger.Debug(ctx, msg, fields)
}

func Info(ctx context.Context, msg string, fields map[string]interface{}) {
	defaultLogger.Info(ctx, msg, fields)
}

func Warn(ctx context.Context, msg string, fields map[string]interface{}) {
	defaultLogger.Warn(ctx, msg, fields)
}

func Error(ctx context.Context, msg string, err error, fields map[string]interface{}) {
	defaultLogger.Error(ctx, msg, err, fields)
}
