package pattern

import (
	"math"
	"time"
)

// Pattern defines an arrival pattern interface.
type Pattern interface {
	// GetRPS returns the current RPS based on elapsed time.
	GetRPS(elapsed time.Duration) float64
}

// Constant implements constant RPS pattern.
type Constant struct {
	RPS float64
}

func (c *Constant) GetRPS(elapsed time.Duration) float64 {
	return c.RPS
}

// Ramp implements linear ramp pattern.
type Ramp struct {
	StartRPS     float64
	EndRPS       float64
	Duration     time.Duration
	StepDuration time.Duration
}

func (r *Ramp) GetRPS(elapsed time.Duration) float64 {
	if elapsed >= r.Duration {
		return r.EndRPS
	}

	// Calculate current step
	if r.StepDuration > 0 {
		stepNum := int(elapsed / r.StepDuration)
		totalSteps := int(r.Duration / r.StepDuration)
		if totalSteps == 0 {
			totalSteps = 1
		}
		progress := float64(stepNum) / float64(totalSteps)
		return r.StartRPS + (r.EndRPS-r.StartRPS)*progress
	}

	// Linear interpolation
	progress := float64(elapsed) / float64(r.Duration)
	return r.StartRPS + (r.EndRPS-r.StartRPS)*progress
}

// Step implements step function pattern.
type Step struct {
	BaseRPS      float64
	StepSize     float64
	StepDuration time.Duration
}

func (s *Step) GetRPS(elapsed time.Duration) float64 {
	stepNum := int(elapsed / s.StepDuration)
	return s.BaseRPS + float64(stepNum)*s.StepSize
}

// Spike implements spike/burst pattern.
type Spike struct {
	BaseRPS         float64
	SpikeRPS        float64
	SpikeAt         time.Duration
	SpikeDuration   time.Duration
}

func (s *Spike) GetRPS(elapsed time.Duration) float64 {
	if elapsed >= s.SpikeAt && elapsed < s.SpikeAt+s.SpikeDuration {
		return s.SpikeRPS
	}
	return s.BaseRPS
}

// Diurnal implements 24-hour sine wave pattern.
type Diurnal struct {
	BaseRPS    float64
	PeakRPS    float64
	PeakHour   int // Hour of day for peak (0-23)
	Period     time.Duration // Simulated day duration
}

func (d *Diurnal) GetRPS(elapsed time.Duration) float64 {
	// Map elapsed time to hour of day
	hourInPeriod := float64(elapsed) / float64(d.Period) * 24
	
	// Sine wave with peak at PeakHour
	offset := float64(d.PeakHour) - 12
	phase := (hourInPeriod - offset) * math.Pi / 12
	
	amplitude := (d.PeakRPS - d.BaseRPS) / 2
	midpoint := (d.PeakRPS + d.BaseRPS) / 2
	
	return midpoint + amplitude*math.Sin(phase)
}

// NewPattern creates a pattern based on configuration.
func NewPattern(patternType string, rps, rpsStart, rpsEnd float64,
	stepDuration, spikeAt, spikeDuration time.Duration,
	spikeMultiplier float64, totalDuration time.Duration) Pattern {
	
	switch patternType {
	case "constant":
		return &Constant{RPS: rps}
	case "ramp":
		return &Ramp{
			StartRPS:     rpsStart,
			EndRPS:       rpsEnd,
			Duration:     totalDuration,
			StepDuration: stepDuration,
		}
	case "step":
		return &Step{
			BaseRPS:      rpsStart,
			StepSize:     (rpsEnd - rpsStart) / 10, // 10 steps
			StepDuration: stepDuration,
		}
	case "spike":
		spikeRPS := rps
		if spikeMultiplier > 0 {
			spikeRPS = rps * spikeMultiplier
		}
		return &Spike{
			BaseRPS:       rps,
			SpikeRPS:      spikeRPS,
			SpikeAt:       spikeAt,
			SpikeDuration: spikeDuration,
		}
	case "diurnal":
		return &Diurnal{
			BaseRPS:  rpsStart,
			PeakRPS:  rpsEnd,
			PeakHour: 14, // 2 PM peak
			Period:   totalDuration,
		}
	default:
		return &Constant{RPS: rps}
	}
}
