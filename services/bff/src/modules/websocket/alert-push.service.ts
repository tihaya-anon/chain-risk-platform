import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { AlertsGateway } from './alerts.gateway';
import { logger } from '../../common/logger';
import { getConfig } from '../../config/config';

interface AlertMessage {
  id?: string;
  type: string;
  severity: string;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  riskScore?: number;
  address?: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

@Injectable()
export class AlertPushService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumer: Consumer;
  private isRunning = false;

  constructor(private readonly alertsGateway: AlertsGateway) {
    const config = getConfig();
    const brokers = config.kafka?.brokers || process.env.KAFKA_BROKERS?.split(',') || ['localhost:19092'];

    this.kafka = new Kafka({
      clientId: 'bff-alert-push',
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: 'bff-alert-push-group',
    });
  }

  async onModuleInit() {
    try {
      await this.start();
    } catch (error) {
      logger.error('Failed to start Alert Push Service', { error });
      // Don't throw - allow BFF to start even if Kafka is not available
    }
  }

  async onModuleDestroy() {
    await this.stop();
  }

  async start() {
    if (this.isRunning) return;

    try {
      await this.consumer.connect();
      logger.info('Alert Push Service connected to Kafka');

      // Subscribe to alert topics
      await this.consumer.subscribe({
        topics: ['alerts', 'alert-notifications'],
        fromBeginning: false,
      });

      this.isRunning = true;

      // Start consuming
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });

      logger.info('Alert Push Service started');
    } catch (error) {
      logger.error('Failed to start Alert Push Service', { error });
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) return;

    try {
      await this.consumer.disconnect();
      this.isRunning = false;
      logger.info('Alert Push Service stopped');
    } catch (error) {
      logger.error('Failed to stop Alert Push Service', { error });
    }
  }

  private async handleMessage(payload: EachMessagePayload) {
    const { topic, partition, message } = payload;

    try {
      if (!message.value) return;

      const alertData: AlertMessage = JSON.parse(message.value.toString());

      // Enrich with timestamp if not present
      if (!alertData.timestamp) {
        alertData.timestamp = Date.now();
      }

      // Generate ID if not present
      if (!alertData.id) {
        alertData.id = `${alertData.type}-${alertData.entityId}-${alertData.timestamp}`;
      }

      logger.debug('Received alert from Kafka', {
        topic,
        partition,
        alertId: alertData.id,
        type: alertData.type,
      });

      // Push to WebSocket
      await this.pushAlert(alertData);
    } catch (error) {
      logger.error('Failed to process alert message', {
        topic,
        partition,
        offset: message.offset,
        error,
      });
    }
  }

  private async pushAlert(alert: AlertMessage) {
    const startTime = Date.now();

    // If alert has address, push to address subscribers
    if (alert.address) {
      this.alertsGateway.pushAlertToAddress(alert.address, alert);
    }

    // Also broadcast high severity alerts
    if (alert.severity === 'critical' || alert.severity === 'high') {
      this.alertsGateway.broadcastAlert(alert);
    }

    const latency = Date.now() - startTime;
    if (latency > 100) {
      logger.warn('Alert push latency high', { alertId: alert.id, latencyMs: latency });
    }

    logger.debug('Alert pushed to WebSocket', {
      alertId: alert.id,
      latencyMs: latency,
    });
  }

  // Manual push method for testing or API-triggered alerts
  pushManualAlert(alert: AlertMessage) {
    if (!alert.timestamp) alert.timestamp = Date.now();
    if (!alert.id) alert.id = `manual-${Date.now()}`;

    this.alertsGateway.broadcastAlert(alert);
    logger.info('Manual alert pushed', { alertId: alert.id });
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      gateway: this.alertsGateway.getStats(),
    };
  }
}
