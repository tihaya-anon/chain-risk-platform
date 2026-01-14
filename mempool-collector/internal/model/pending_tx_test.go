package model

import (
	"math/big"
	"testing"
)

func TestPendingTx_ToJSON(t *testing.T) {
	tx := &PendingTx{
		Hash:     "0xabc123",
		From:     "0xsender",
		To:       "0xreceiver",
		Value:    "1000000000000000000",
		Gas:      21000,
		GasPrice: "50000000000",
		Nonce:    1,
		Network:  "ethereum",
	}

	data, err := tx.ToJSON()
	if err != nil {
		t.Fatalf("ToJSON failed: %v", err)
	}

	if len(data) == 0 {
		t.Fatal("ToJSON returned empty data")
	}

	// Verify can parse back
	parsed, err := ParseFromJSON(data)
	if err != nil {
		t.Fatalf("ParseFromJSON failed: %v", err)
	}

	if parsed.Hash != tx.Hash {
		t.Errorf("Hash mismatch: got %s, want %s", parsed.Hash, tx.Hash)
	}
	if parsed.From != tx.From {
		t.Errorf("From mismatch: got %s, want %s", parsed.From, tx.From)
	}
	if parsed.Gas != tx.Gas {
		t.Errorf("Gas mismatch: got %d, want %d", parsed.Gas, tx.Gas)
	}
}

func TestParseFromJSON_InvalidJSON(t *testing.T) {
	_, err := ParseFromJSON([]byte("invalid json"))
	if err == nil {
		t.Fatal("Expected error for invalid JSON")
	}
}

func TestPendingTx_GasPriceWei(t *testing.T) {
	tests := []struct {
		name     string
		gasPrice string
		want     *big.Int
	}{
		{
			name:     "standard gas price",
			gasPrice: "50000000000",
			want:     big.NewInt(50000000000),
		},
		{
			name:     "zero gas price",
			gasPrice: "0",
			want:     big.NewInt(0),
		},
		{
			name:     "large gas price",
			gasPrice: "100000000000000",
			want:     big.NewInt(100000000000000),
		},
		{
			name:     "empty gas price",
			gasPrice: "",
			want:     nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tx := &PendingTx{GasPrice: tt.gasPrice}
			got := tx.GasPriceWei()

			if tt.want == nil {
				if got != nil {
					t.Errorf("GasPriceWei() = %v, want nil", got)
				}
				return
			}

			if got == nil || got.Cmp(tt.want) != 0 {
				t.Errorf("GasPriceWei() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPendingTx_EffectiveGasPrice(t *testing.T) {
	tests := []struct {
		name      string
		tx        *PendingTx
		wantValue int64
	}{
		{
			name: "legacy tx uses gas price",
			tx: &PendingTx{
				TxType:   0,
				GasPrice: "50000000000",
			},
			wantValue: 50000000000,
		},
		{
			name: "EIP-1559 tx uses gas fee cap",
			tx: &PendingTx{
				TxType:    2,
				GasPrice:  "50000000000",
				GasFeeCap: "100000000000",
			},
			wantValue: 100000000000,
		},
		{
			name: "EIP-1559 without fee cap falls back to gas price",
			tx: &PendingTx{
				TxType:    2,
				GasPrice:  "50000000000",
				GasFeeCap: "",
			},
			wantValue: 50000000000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.tx.EffectiveGasPrice()
			want := big.NewInt(tt.wantValue)

			if got.Cmp(want) != 0 {
				t.Errorf("EffectiveGasPrice() = %v, want %v", got, want)
			}
		})
	}
}

func TestPendingTx_IsDEXSwap(t *testing.T) {
	tests := []struct {
		name     string
		methodID string
		want     bool
	}{
		// Uniswap V2 methods
		{"swapExactTokensForTokens", "0x38ed1739", true},
		{"swapTokensForExactTokens", "0x8803dbee", true},
		{"swapExactETHForTokens", "0x7ff36ab5", true},
		{"swapTokensForExactETH", "0x4a25d94a", true},
		{"swapExactTokensForETH", "0x18cbafe5", true},
		{"swapETHForExactTokens", "0xfb3bdb41", true},

		// Uniswap V3 methods
		{"multicall", "0x5ae401dc", true},
		{"exactInputSingle", "0x414bf389", true},
		{"exactInput", "0xc04b8d59", true},
		{"exactOutputSingle", "0xdb3e2198", true},

		// Non-swap methods
		{"transfer", "0xa9059cbb", false},
		{"approve", "0x095ea7b3", false},
		{"empty", "", false},
		{"short", "0x38ed", false},

		// With extra data (method + params)
		{"swapWithParams", "0x38ed1739000000000000000000000000", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tx := &PendingTx{MethodID: tt.methodID}
			if got := tx.IsDEXSwap(); got != tt.want {
				t.Errorf("IsDEXSwap() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestMethodIDConstants(t *testing.T) {
	// Verify method ID constants have correct format
	methods := []string{
		MethodSwapExactTokensForTokens,
		MethodSwapTokensForExactTokens,
		MethodSwapExactETHForTokens,
		MethodSwapTokensForExactETH,
		MethodSwapExactTokensForETH,
		MethodSwapETHForExactTokens,
		MethodMulticall,
		MethodExactInputSingle,
		MethodExactInput,
		MethodExactOutputSingle,
	}

	for _, method := range methods {
		if len(method) != 10 {
			t.Errorf("Method %s has wrong length: %d, want 10", method, len(method))
		}
		if method[:2] != "0x" {
			t.Errorf("Method %s doesn't start with 0x", method)
		}
	}
}
