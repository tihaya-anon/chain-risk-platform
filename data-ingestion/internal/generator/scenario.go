package generator

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/producer"
	"go.uber.org/zap"
)

// Scenario defines a test scenario
type Scenario struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Events      []ScenarioEvent `json:"events"`
	Loop        bool            `json:"loop"` // loop events when finished
}

// ScenarioEvent defines a single event in a scenario
type ScenarioEvent struct {
	Type     string          `json:"type"`     // "transaction", "block", "pattern"
	Count    int             `json:"count"`    // number of events to generate
	Delay    int             `json:"delay"`    // delay in milliseconds before this event
	Template json.RawMessage `json:"template"` // event template
	Pattern  *PatternConfig  `json:"pattern"`  // pattern configuration
}

// PatternConfig defines a risk pattern
type PatternConfig struct {
	Type       string   `json:"type"`       // "high_risk_cluster", "whale_movement", "mixer"
	Addresses  []string `json:"addresses"`  // involved addresses
	ValueRange []string `json:"valueRange"` // [min, max] in wei
	TxCount    int      `json:"txCount"`    // number of transactions in pattern
}

// LoadScenario loads a scenario from file
func LoadScenario(path string) (*Scenario, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read scenario file: %w", err)
	}

	var scenario Scenario
	if err := json.Unmarshal(data, &scenario); err != nil {
		return nil, fmt.Errorf("parse scenario: %w", err)
	}

	if scenario.Name == "" {
		return nil, fmt.Errorf("scenario name required")
	}
	if len(scenario.Events) == 0 {
		return nil, fmt.Errorf("scenario must have at least one event")
	}

	return &scenario, nil
}

// ScenarioRunner executes scenario events
type ScenarioRunner struct {
	scenario     *Scenario
	network      string
	logger       *zap.Logger
	random       *RandomGenerator
	currentEvent int
	eventCount   int
	loopCount    int
}

// NewScenarioRunner creates a new scenario runner
func NewScenarioRunner(scenario *Scenario, network string, logger *zap.Logger) *ScenarioRunner {
	return &ScenarioRunner{
		scenario: scenario,
		network:  network,
		logger:   logger,
		random:   NewRandomGenerator(network, logger),
	}
}

// Next generates the next event in the scenario
func (r *ScenarioRunner) Next(blockNumber uint64) (*producer.RawBlockData, error) {
	if r.currentEvent >= len(r.scenario.Events) {
		if r.scenario.Loop {
			r.currentEvent = 0
			r.loopCount++
			r.logger.Info("Scenario loop", zap.Int("loop", r.loopCount))
		} else {
			return nil, fmt.Errorf("scenario complete")
		}
	}

	event := r.scenario.Events[r.currentEvent]

	var data *producer.RawBlockData
	var err error

	switch event.Type {
	case "transaction", "block":
		data, err = r.generateFromTemplate(blockNumber, &event)
	case "pattern":
		data, err = r.generatePattern(blockNumber, event.Pattern)
	default:
		// Default to random generation with event count
		data, err = r.random.Generate(blockNumber)
	}

	if err != nil {
		return nil, err
	}

	r.eventCount++
	if r.eventCount >= event.Count {
		r.eventCount = 0
		r.currentEvent++
	}

	return data, nil
}

func (r *ScenarioRunner) generateFromTemplate(blockNumber uint64, event *ScenarioEvent) (*producer.RawBlockData, error) {
	// If template is provided, use it as base
	if len(event.Template) > 0 {
		var block map[string]interface{}
		if err := json.Unmarshal(event.Template, &block); err != nil {
			return nil, fmt.Errorf("parse template: %w", err)
		}

		// Override block number
		block["number"] = fmt.Sprintf("0x%x", blockNumber)

		// Wrap in Etherscan API format
		apiResponse := map[string]interface{}{
			"id":      1,
			"jsonrpc": "2.0",
			"result":  block,
		}

		rawBlock, err := json.Marshal(apiResponse)
		if err != nil {
			return nil, err
		}

		return &producer.RawBlockData{
			Network:     r.network,
			BlockNumber: blockNumber,
			Timestamp:   r.random.randomTimestamp(),
			RawBlock:    rawBlock,
		}, nil
	}

	// Otherwise generate random block
	return r.random.Generate(blockNumber)
}

func (r *ScenarioRunner) generatePattern(blockNumber uint64, pattern *PatternConfig) (*producer.RawBlockData, error) {
	if pattern == nil {
		return r.random.Generate(blockNumber)
	}

	var txs []map[string]interface{}

	switch pattern.Type {
	case "high_risk_cluster":
		txs = r.generateHighRiskCluster(pattern)
	case "whale_movement":
		txs = r.generateWhaleMovement(pattern)
	case "mixer":
		txs = r.generateMixerPattern(pattern)
	default:
		txs = r.random.generateTransactions(5)
	}

	block := r.random.buildBlock(blockNumber, txs)

	// Wrap in Etherscan API format
	apiResponse := map[string]interface{}{
		"id":      1,
		"jsonrpc": "2.0",
		"result":  block,
	}

	rawBlock, err := json.Marshal(apiResponse)
	if err != nil {
		return nil, err
	}

	return &producer.RawBlockData{
		Network:     r.network,
		BlockNumber: blockNumber,
		Timestamp:   r.random.randomTimestamp(),
		RawBlock:    rawBlock,
	}, nil
}

func (r *ScenarioRunner) generateHighRiskCluster(pattern *PatternConfig) []map[string]interface{} {
	addresses := pattern.Addresses
	if len(addresses) < 2 {
		addresses = r.random.generateAddresses(5)
	}

	txCount := pattern.TxCount
	if txCount == 0 {
		txCount = len(addresses) * 2
	}

	txs := make([]map[string]interface{}, txCount)
	for i := 0; i < txCount; i++ {
		from := addresses[i%len(addresses)]
		to := addresses[(i+1)%len(addresses)]
		txs[i] = r.random.buildTransaction(from, to, r.random.randomHighValue())
	}

	return txs
}

func (r *ScenarioRunner) generateWhaleMovement(pattern *PatternConfig) []map[string]interface{} {
	whale := r.random.randomAddress()
	if len(pattern.Addresses) > 0 {
		whale = pattern.Addresses[0]
	}

	txCount := pattern.TxCount
	if txCount == 0 {
		txCount = 3
	}

	txs := make([]map[string]interface{}, txCount)
	for i := 0; i < txCount; i++ {
		to := r.random.randomAddress()
		if i < len(pattern.Addresses)-1 {
			to = pattern.Addresses[i+1]
		}
		txs[i] = r.random.buildTransaction(whale, to, r.random.randomWhaleValue())
	}

	return txs
}

func (r *ScenarioRunner) generateMixerPattern(pattern *PatternConfig) []map[string]interface{} {
	mixer := r.random.randomAddress()
	if len(pattern.Addresses) > 0 {
		mixer = pattern.Addresses[0]
	}

	// Multiple inputs to mixer
	inputs := 5
	outputs := 5
	txs := make([]map[string]interface{}, inputs+outputs)

	// Inputs
	for i := 0; i < inputs; i++ {
		from := r.random.randomAddress()
		txs[i] = r.random.buildTransaction(from, mixer, r.random.randomValue())
	}

	// Outputs (same amounts)
	for i := 0; i < outputs; i++ {
		to := r.random.randomAddress()
		txs[inputs+i] = r.random.buildTransaction(mixer, to, r.random.randomValue())
	}

	return txs
}
