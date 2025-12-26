# Stream Processor

基于 Apache Flink 的实时流处理服务，负责从 Kafka 消费链上事件并提取 Transfer 数据。

## 功能

- 消费 Kafka 中的链上事件 (ChainEvent)
- 解析 Transaction 并提取 Native Transfer
- 解析 ERC20 Transfer 事件
- 写入 PostgreSQL 数据库

## 技术栈

- **框架**: Apache Flink 1.18
- **语言**: Java 17
- **消息队列**: Kafka
- **数据库**: PostgreSQL

## 目录结构

```
stream-processor/
├── src/main/java/com/chainrisk/stream/
│   ├── StreamProcessorApp.java    # 应用入口
│   ├── job/
│   │   └── TransferExtractionJob.java  # Flink Job
│   ├── model/
│   │   ├── ChainEvent.java        # Kafka 事件模型
│   │   ├── Transaction.java       # 交易模型
│   │   └── Transfer.java          # Transfer 模型
│   ├── parser/
│   │   ├── ChainEventDeserializer.java  # Kafka 反序列化
│   │   └── TransferParser.java    # Transfer 解析器
│   └── sink/
│       └── JdbcSinkFactory.java   # JDBC Sink 工厂
├── src/main/resources/
│   ├── application.properties     # 配置文件
│   └── logback.xml               # 日志配置
└── pom.xml
```

## 构建

```bash
cd processing
mvn clean package -pl stream-processor -am
```

## 运行

### 本地运行

```bash
# 使用默认配置
java -jar target/stream-processor-1.0.0-SNAPSHOT.jar

# 自定义配置
java -jar target/stream-processor-1.0.0-SNAPSHOT.jar \
  --kafka.brokers=localhost:9092 \
  --kafka.topic=chain-transactions \
  --jdbc.url=jdbc:postgresql://localhost:5432/chainrisk
```

### Flink 集群运行

```bash
flink run -c com.chainrisk.stream.StreamProcessorApp \
  target/stream-processor-1.0.0-SNAPSHOT.jar \
  --kafka.brokers=kafka:9092
```

## 配置参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `kafka.brokers` | Kafka 地址 | localhost:9092 |
| `kafka.topic` | Kafka Topic | chain-transactions |
| `kafka.group.id` | Consumer Group ID | stream-processor |
| `jdbc.url` | PostgreSQL URL | jdbc:postgresql://localhost:5432/chainrisk |
| `jdbc.user` | 数据库用户 | chainrisk |
| `jdbc.password` | 数据库密码 | chainrisk123 |

## 数据流

```
Kafka (chain-transactions)
    │
    ▼
ChainEventDeserializer
    │
    ▼
TransferParser (FlatMap)
    │
    ├── Transaction → Native Transfer
    │
    └── ERC20 Input → Token Transfer
    │
    ▼
PostgreSQL (chain_data.transfers)
```
