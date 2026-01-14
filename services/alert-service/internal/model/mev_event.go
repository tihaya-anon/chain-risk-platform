package model

import "time"

// MevAlertType constants
const (
	MevAlertTypeSandwich   = "SANDWICH_ATTACK"
	MevAlertTypeFrontRun   = "FRONT_RUN"
	MevAlertTypeAbnormalGas = "ABNORMAL_GAS"
)

// MevAlertEvent represents an MEV alert from Flink MEV detection job
type MevAlertEvent struct {
	AlertID          string   `json:"alert_id"`
	AlertType        string   `json:"alert_type"`
	Network          string   `json:"network"`
	Timestamp        int64    `json:"timestamp"`
	AttackerAddress  string   `json:"attacker_address"`
	VictimAddress    string   `json:"victim_address,omitempty"`
	VictimTxHash     string   `json:"victim_tx_hash,omitempty"`
	FrontTxHash      string   `json:"front_tx_hash,omitempty"`
	BackTxHash       string   `json:"back_tx_hash,omitempty"`
	TargetContract   string   `json:"target_contract,omitempty"`
	EstimatedProfit  string   `json:"estimated_profit_wei,omitempty"`
	GasPriceDiff     string   `json:"gas_price_diff,omitempty"`
	Severity         string   `json:"severity"`
	RelatedTxs       []string `json:"related_txs,omitempty"`
}

// ToEvent converts MevAlertEvent to generic Event for evaluation
func (e *MevAlertEvent) ToEvent() Event {
	return Event{
		Type:      EventTypeMev,
		Timestamp: time.UnixMilli(e.Timestamp),
		Data: map[string]any{
			"alert_id":         e.AlertID,
			"alert_type":       e.AlertType,
			"network":          e.Network,
			"attacker_address": e.AttackerAddress,
			"victim_address":   e.VictimAddress,
			"victim_tx_hash":   e.VictimTxHash,
			"front_tx_hash":    e.FrontTxHash,
			"back_tx_hash":     e.BackTxHash,
			"target_contract":  e.TargetContract,
			"estimated_profit": e.EstimatedProfit,
			"gas_price_diff":   e.GasPriceDiff,
			"severity":         e.Severity,
			"related_txs":      e.RelatedTxs,
		},
	}
}

// ToAlert converts MevAlertEvent directly to an Alert
func (e *MevAlertEvent) ToAlert() *Alert {
	title := formatMevAlertTitle(e.AlertType, e.AttackerAddress)
	message := formatMevAlertMessage(e)

	return &Alert{
		Type:       e.AlertType,
		Severity:   e.Severity,
		EntityType: EntityTypeMev,
		EntityID:   e.AlertID,
		Title:      title,
		Message:    message,
		Metadata: map[string]any{
			"attacker_address": e.AttackerAddress,
			"victim_address":   e.VictimAddress,
			"victim_tx_hash":   e.VictimTxHash,
			"front_tx_hash":    e.FrontTxHash,
			"back_tx_hash":     e.BackTxHash,
			"target_contract":  e.TargetContract,
			"estimated_profit": e.EstimatedProfit,
			"gas_price_diff":   e.GasPriceDiff,
			"network":          e.Network,
			"related_txs":      e.RelatedTxs,
		},
	}
}

func formatMevAlertTitle(alertType, attacker string) string {
	shortAddr := attacker
	if len(attacker) > 10 {
		shortAddr = attacker[:6] + "..." + attacker[len(attacker)-4:]
	}
	switch alertType {
	case MevAlertTypeSandwich:
		return "Sandwich Attack Detected: " + shortAddr
	case MevAlertTypeFrontRun:
		return "Front-Run Detected: " + shortAddr
	case MevAlertTypeAbnormalGas:
		return "Abnormal Gas Price: " + shortAddr
	default:
		return "MEV Alert: " + shortAddr
	}
}

func formatMevAlertMessage(e *MevAlertEvent) string {
	switch e.AlertType {
	case MevAlertTypeSandwich:
		return "Sandwich attack detected. Attacker: " + e.AttackerAddress +
			", Victim: " + e.VictimAddress +
			", Target: " + e.TargetContract
	case MevAlertTypeFrontRun:
		return "Front-run detected. Attacker: " + e.AttackerAddress +
			", Victim: " + e.VictimAddress +
			", Gas diff: " + e.GasPriceDiff
	case MevAlertTypeAbnormalGas:
		return "Abnormal gas price detected. Address: " + e.AttackerAddress +
			", Gas diff: " + e.GasPriceDiff
	default:
		return "MEV activity detected: " + e.AlertID
	}
}
