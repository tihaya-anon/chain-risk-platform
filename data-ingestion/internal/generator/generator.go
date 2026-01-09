package generator

import (
	"context"
	"fmt"
	"time"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/producer"
	"go.uber.org/zap"
)

// Config holds generator configuration
type Config struct {
	Mode         string  // "random" or "scenario"
	ScenarioFile string  // path to scenario file (for scenario mode)
	TPS          float64 // transactions per second
	Duration     int     // duration in seconds (0 = infinite)
	Network      string  // "ethereum" or "bsc"
}

// Generator generates synthetic blockchain data
type Generator struct {
	config   *Config
	producer producer.Producer
	logger   *zap.Logger
	random   *RandomGenerator
	scenario *ScenarioRunner
}

// Stats tracks generation statistics
type Stats struct {
	TotalBlocks       uint64
	TotalTransactions uint64
	TotalBytes        uint64
	StartTime         time.Time
	LastBlockNumber   uint64
}

// New creates a new generator
func New(cfg *Config, prod producer.Producer, logger *zap.Logger) (*Generator, error) {
	g := &Generator{
		config:   cfg,
		producer: prod,
		logger:   logger,
	}

	switch cfg.Mode {
	case "random":
		g.random = NewRandomGenerator(cfg.Network, logger)
	case "scenario":
		if cfg.ScenarioFile == "" {
			return nil, fmt.Errorf("scenario file required for scenario mode")
		}
		scenario, err := LoadScenario(cfg.ScenarioFile)
		if err != nil {
			return nil, fmt.Errorf("load scenario: %w", err)
		}
		g.scenario = NewScenarioRunner(scenario, cfg.Network, logger)
	default:
		return nil, fmt.Errorf("unknown mode: %s", cfg.Mode)
	}

	return g, nil
}

// Run starts the generator
func (g *Generator) Run(ctx context.Context) error {
	stats := &Stats{StartTime: time.Now()}
	interval := time.Duration(float64(time.Second) / g.config.TPS)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	var deadline <-chan time.Time
	if g.config.Duration > 0 {
		timer := time.NewTimer(time.Duration(g.config.Duration) * time.Second)
		deadline = timer.C
		defer timer.Stop()
	}

	g.logger.Info("Generator started",
		zap.String("mode", g.config.Mode),
		zap.Float64("tps", g.config.TPS),
		zap.Int("duration", g.config.Duration))

	statsTicker := time.NewTicker(10 * time.Second)
	defer statsTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			g.logFinalStats(stats)
			return ctx.Err()
		case <-deadline:
			g.logger.Info("Duration reached")
			g.logFinalStats(stats)
			return nil
		case <-statsTicker.C:
			g.logStats(stats)
		case <-ticker.C:
			if err := g.generateAndSend(ctx, stats); err != nil {
				g.logger.Error("Generate failed", zap.Error(err))
			}
		}
	}
}

func (g *Generator) generateAndSend(ctx context.Context, stats *Stats) error {
	var data *producer.RawBlockData
	var err error

	switch g.config.Mode {
	case "random":
		data, err = g.random.Generate(stats.LastBlockNumber + 1)
	case "scenario":
		data, err = g.scenario.Next(stats.LastBlockNumber + 1)
	}

	if err != nil {
		return err
	}

	if err := g.producer.SendRawBlock(ctx, data); err != nil {
		return err
	}

	stats.TotalBlocks++
	stats.LastBlockNumber = data.BlockNumber
	stats.TotalBytes += uint64(len(data.RawBlock))

	return nil
}

func (g *Generator) logStats(stats *Stats) {
	elapsed := time.Since(stats.StartTime).Seconds()
	actualTPS := float64(stats.TotalBlocks) / elapsed

	g.logger.Info("Generator stats",
		zap.Uint64("blocks", stats.TotalBlocks),
		zap.Float64("actual_tps", actualTPS),
		zap.Uint64("last_block", stats.LastBlockNumber),
		zap.String("throughput", formatBytes(float64(stats.TotalBytes)/elapsed)+"/s"))
}

func (g *Generator) logFinalStats(stats *Stats) {
	elapsed := time.Since(stats.StartTime).Seconds()
	g.logger.Info("Final stats",
		zap.Uint64("total_blocks", stats.TotalBlocks),
		zap.Float64("duration_seconds", elapsed),
		zap.Float64("avg_tps", float64(stats.TotalBlocks)/elapsed),
		zap.String("total_bytes", formatBytes(float64(stats.TotalBytes))))
}

func formatBytes(b float64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%.1f B", b)
	}
	div, exp := float64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", b/div, "KMGTPE"[exp])
}

// DryRunProducer is a no-op producer for testing
type DryRunProducer struct {
	logger *zap.Logger
	count  uint64
}

func NewDryRunProducer(logger *zap.Logger) *DryRunProducer {
	return &DryRunProducer{logger: logger}
}

func (p *DryRunProducer) SendRawBlock(ctx context.Context, data *producer.RawBlockData) error {
	p.count++
	if p.count%100 == 0 {
		p.logger.Debug("Dry-run sent", zap.Uint64("count", p.count))
	}
	return nil
}

func (p *DryRunProducer) SendRawBlocks(ctx context.Context, blocks []*producer.RawBlockData) error {
	p.count += uint64(len(blocks))
	return nil
}

func (p *DryRunProducer) Close() error {
	p.logger.Info("Dry-run producer closed", zap.Uint64("total_sent", p.count))
	return nil
}
