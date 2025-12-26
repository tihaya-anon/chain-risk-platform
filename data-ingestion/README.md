# Data Ingestion Service

链上数据采集服务，负责从区块链网络获取交易数据并发送到 Kafka。

## 技术栈

- **语言**: Go 1.21+
- **配置**: Viper
- **日志**: Zap
- **消息队列**: Kafka (Sarama)

## 目录结构

```
data-ingestion/
├── cmd/
│   └── ingestion/
│       └── main.go          # 程序入口
├── internal/
│   ├── client/              # 区块链 API 客户端
│   │   ├── etherscan.go
│   │   └── client.go
│   ├── producer/            # Kafka 生产者
│   │   └── kafka.go
│   ├── model/               # 数据模型
│   │   └── transaction.go
│   └── config/              # 配置管理
│       └── config.go
├── pkg/
│   └── blockchain/          # 可复用的区块链工具
│       └── types.go
├── configs/
│   └── config.yaml          # 配置文件
└── test/
```

## 快速开始

```bash
# 安装依赖
go mod tidy

# 运行
go run ./cmd/ingestion

# 构建
go build -o bin/ingestion ./cmd/ingestion
```

## 配置

复制配置模板并修改：

```bash
cp configs/config.example.yaml configs/config.yaml
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ETHERSCAN_API_KEY` | Etherscan API Key | - |
| `KAFKA_BROKERS` | Kafka 地址 | localhost:9092 |
