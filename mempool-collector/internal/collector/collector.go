package collector

import (
	"context"
	"encoding/hex"
	"sync"
	"time"

	"github.com/chain-risk-platform/mempool-collector/internal/config"
	"github.com/chain-risk-platform/mempool-collector/internal/model"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/rpc"
	"go.uber.org/zap"
)

// Collector subscribes to Ethereum mempool and collects pending transactions
type Collector struct {
	cfg        *config.EthereumConfig
	logger     *zap.Logger
	txChan     chan *model.PendingTx
	rpcClient  *rpc.Client
	ethClient  *ethclient.Client
	mu         sync.RWMutex
	connected  bool
	stopCh     chan struct{}
	metrics    *Metrics
}

// NewCollector creates a new mempool collector
func NewCollector(cfg *config.EthereumConfig, logger *zap.Logger, metrics *Metrics) *Collector {
	return &Collector{
		cfg:     cfg,
		logger:  logger,
		txChan:  make(chan *model.PendingTx, cfg.SubscriptionBuffer),
		stopCh:  make(chan struct{}),
		metrics: metrics,
	}
}

// TxChannel returns channel for receiving pending transactions
func (c *Collector) TxChannel() <-chan *model.PendingTx {
	return c.txChan
}

// IsConnected returns connection status
func (c *Collector) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

// Start begins collecting pending transactions
func (c *Collector) Start(ctx context.Context) error {
	go c.runWithReconnect(ctx)
	return nil
}

// Stop gracefully stops the collector
func (c *Collector) Stop() {
	close(c.stopCh)
	if c.rpcClient != nil {
		c.rpcClient.Close()
	}
	close(c.txChan)
}

func (c *Collector) runWithReconnect(ctx context.Context) {
	reconnectDelay := c.cfg.ReconnectInterval
	maxDelay := c.cfg.MaxReconnectDelay

	for {
		select {
		case <-ctx.Done():
			return
		case <-c.stopCh:
			return
		default:
		}

		err := c.connect(ctx)
		if err != nil {
			c.logger.Error("Failed to connect", zap.Error(err))
			c.setConnected(false)
			time.Sleep(reconnectDelay)
			reconnectDelay = min(reconnectDelay*2, maxDelay)
			continue
		}

		reconnectDelay = c.cfg.ReconnectInterval
		c.setConnected(true)
		c.metrics.ConnectionStatus.Set(1)

		err = c.subscribe(ctx)
		if err != nil {
			c.logger.Error("Subscription error", zap.Error(err))
			c.setConnected(false)
			c.metrics.ConnectionStatus.Set(0)
		}
	}
}

func (c *Collector) connect(ctx context.Context) error {
	var err error
	c.rpcClient, err = rpc.DialContext(ctx, c.cfg.WSURL)
	if err != nil {
		return err
	}
	c.ethClient = ethclient.NewClient(c.rpcClient)
	c.logger.Info("Connected to Ethereum node", zap.String("url", c.cfg.WSURL))
	return nil
}

func (c *Collector) subscribe(ctx context.Context) error {
	txHashCh := make(chan common.Hash, c.cfg.SubscriptionBuffer)

	sub, err := c.rpcClient.EthSubscribe(ctx, txHashCh, "newPendingTransactions")
	if err != nil {
		return err
	}
	defer sub.Unsubscribe()

	c.logger.Info("Subscribed to newPendingTransactions")

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-c.stopCh:
			return nil
		case err := <-sub.Err():
			return err
		case txHash := <-txHashCh:
			go c.processTxHash(ctx, txHash)
		}
	}
}

func (c *Collector) processTxHash(ctx context.Context, hash common.Hash) {
	c.metrics.TxReceived.Inc()

	tx, isPending, err := c.ethClient.TransactionByHash(ctx, hash)
	if err != nil {
		c.metrics.TxFetchErrors.Inc()
		return
	}
	if !isPending {
		return
	}

	pendingTx := c.convertTx(tx)
	
	select {
	case c.txChan <- pendingTx:
		c.metrics.TxProcessed.Inc()
	default:
		c.metrics.TxDropped.Inc()
	}
}

func (c *Collector) convertTx(tx *types.Transaction) *model.PendingTx {
	msg, err := types.Sender(types.LatestSignerForChainID(tx.ChainId()), tx)
	from := ""
	if err == nil {
		from = msg.Hex()
	}

	to := ""
	if tx.To() != nil {
		to = tx.To().Hex()
	}

	input := hex.EncodeToString(tx.Data())
	methodID := ""
	if len(tx.Data()) >= 4 {
		methodID = "0x" + hex.EncodeToString(tx.Data()[:4])
	}

	pendingTx := &model.PendingTx{
		Hash:      tx.Hash().Hex(),
		From:      from,
		To:        to,
		Value:     tx.Value().String(),
		Gas:       tx.Gas(),
		Nonce:     tx.Nonce(),
		Input:     "0x" + input,
		MethodID:  methodID,
		Timestamp: time.Now().UnixMilli(),
		Network:   c.cfg.Network,
		TxType:    tx.Type(),
	}

	switch tx.Type() {
	case types.DynamicFeeTxType: // EIP-1559
		pendingTx.GasFeeCap = tx.GasFeeCap().String()
		pendingTx.GasTipCap = tx.GasTipCap().String()
		pendingTx.GasPrice = tx.GasFeeCap().String()
	default:
		pendingTx.GasPrice = tx.GasPrice().String()
	}

	if to != "" && pendingTx.IsDEXSwap() {
		pendingTx.TokenTarget = to
	}

	return pendingTx
}

func (c *Collector) setConnected(status bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.connected = status
}
