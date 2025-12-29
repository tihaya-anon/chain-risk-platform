package model

import (
	"time"
)

// AddressInfo represents aggregated information about an address
type AddressInfo struct {
	Address          string    `json:"address"`
	Network          string    `json:"network"`
	FirstSeen        time.Time `json:"firstSeen"`
	LastSeen         time.Time `json:"lastSeen"`
	TotalTxCount     int64     `json:"totalTxCount"`
	SentTxCount      int64     `json:"sentTxCount"`
	ReceivedTxCount  int64     `json:"receivedTxCount"`
	UniqueInteracted int64     `json:"uniqueInteracted"`
}

// AddressInfoResponse is the API response format
type AddressInfoResponse struct {
	Address          string `json:"address"`
	Network          string `json:"network"`
	FirstSeen        string `json:"firstSeen"`
	LastSeen         string `json:"lastSeen"`
	TotalTxCount     int64  `json:"totalTxCount"`
	SentTxCount      int64  `json:"sentTxCount"`
	ReceivedTxCount  int64  `json:"receivedTxCount"`
	UniqueInteracted int64  `json:"uniqueInteracted"`
}

// ToResponse converts AddressInfo to AddressInfoResponse
func (a *AddressInfo) ToResponse() AddressInfoResponse {
	return AddressInfoResponse{
		Address:          a.Address,
		Network:          a.Network,
		FirstSeen:        a.FirstSeen.UTC().Format(time.RFC3339),
		LastSeen:         a.LastSeen.UTC().Format(time.RFC3339),
		TotalTxCount:     a.TotalTxCount,
		SentTxCount:      a.SentTxCount,
		ReceivedTxCount:  a.ReceivedTxCount,
		UniqueInteracted: a.UniqueInteracted,
	}
}

// AddressStats represents statistics for an address
type AddressStats struct {
	TotalValueSent     string `json:"totalValueSent"`
	TotalValueReceived string `json:"totalValueReceived"`
	AvgTxValue         string `json:"avgTxValue"`
	MaxTxValue         string `json:"maxTxValue"`
	MinTxValue         string `json:"minTxValue"`
}
