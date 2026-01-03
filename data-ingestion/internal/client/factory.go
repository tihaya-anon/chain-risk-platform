package client

// ClientFactory creates blockchain clients based on network type
type ClientFactory struct{}

// NewClientFactory creates a new ClientFactory
func NewClientFactory() *ClientFactory {
	return &ClientFactory{}
}

// CreateClient creates a blockchain client for the specified network
func (f *ClientFactory) CreateClient(network, baseURL, apiKey string, rateLimit int) (BlockchainClient, error) {
	switch network {
	case "ethereum", "bsc":
		return NewEtherscanClient(network, baseURL, apiKey, rateLimit)
	default:
		return NewEtherscanClient("ethereum", baseURL, apiKey, rateLimit)
	}
}
