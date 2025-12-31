import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { NacosNamingClient, NacosConfigClient } from 'nacos';
import * as yaml from 'js-yaml';

export interface PipelineConfig {
  pipeline: {
    enabled: boolean;
    ingestion: {
      enabled: boolean;
    };
    graphSync: {
      enabled: boolean;
    };
  };
  risk: {
    highThreshold: number;
    mediumThreshold: number;
    cacheTtlSeconds: number;
  };
}

@Injectable()
export class NacosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NacosService.name);
  private namingClient: NacosNamingClient | null = null;
  private configClient: NacosConfigClient | null = null;
  private config: PipelineConfig | null = null;
  private readonly serviceName = 'bff';
  private readonly servicePort: number;
  private readonly serviceIP: string;
  private readonly nacosServer: string;
  private enabled = false;

  constructor() {
    this.nacosServer = process.env.NACOS_SERVER || '';
    this.serviceIP = process.env.SERVICE_IP || '127.0.0.1';
    this.servicePort = parseInt(process.env.BFF_PORT || '3001', 10);
    this.enabled = !!this.nacosServer;
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log('NACOS_SERVER not set, running without Nacos integration');
      return;
    }

    try {
      const [host, portStr] = this.nacosServer.split(':');
      const port = parseInt(portStr || '18848', 10);

      // Initialize naming client for service discovery
      this.namingClient = new NacosNamingClient({
        logger: console,
        serverList: `${host}:${port}`,
        namespace: process.env.NACOS_NAMESPACE || '',
      });

      await this.namingClient.ready();

      // Register service
      await this.namingClient.registerInstance(this.serviceName, {
        ip: this.serviceIP,
        port: this.servicePort,
        healthy: true,
        enabled: true,
        weight: 10,
      } as any);

      this.logger.log(`Service registered with Nacos: ${this.serviceName} at ${this.serviceIP}:${this.servicePort}`);

      // Initialize config client
      this.configClient = new NacosConfigClient({
        serverAddr: `${host}:${port}`,
        namespace: process.env.NACOS_NAMESPACE || '',
      });

      // Load initial config
      await this.loadConfig();

      // Subscribe to config changes
      this.configClient.subscribe(
        {
          dataId: 'chain-risk-pipeline.yaml',
          group: 'DEFAULT_GROUP',
        },
        (content: string) => {
          this.parseConfig(content);
        },
      );

      this.logger.log('Nacos client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Nacos client', error);
    }
  }

  async onModuleDestroy() {
    if (!this.enabled) return;

    try {
      if (this.namingClient) {
        await this.namingClient.deregisterInstance(this.serviceName, {
          ip: this.serviceIP,
          port: this.servicePort,
          instanceId: '',
          healthy: true,
          enabled: true,
        } as any);
        this.logger.log('Service deregistered from Nacos');
      }
    } catch (error) {
      this.logger.error('Failed to deregister from Nacos', error);
    }
  }

  private async loadConfig() {
    if (!this.configClient) return;

    try {
      const content = await this.configClient.getConfig(
        'chain-risk-pipeline.yaml',
        'DEFAULT_GROUP',
      );
      if (content) {
        this.parseConfig(content);
      }
    } catch (error) {
      this.logger.warn('Failed to load config from Nacos', error);
    }
  }

  private parseConfig(content: string) {
    try {
      const parsed = yaml.load(content) as PipelineConfig;
      this.config = parsed;
      this.logger.log('Configuration updated from Nacos', {
        pipelineEnabled: parsed?.pipeline?.enabled,
        cacheTtlSeconds: parsed?.risk?.cacheTtlSeconds,
      });
    } catch (error) {
      this.logger.error('Failed to parse Nacos config', error);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getConfig(): PipelineConfig | null {
    return this.config;
  }

  isPipelineEnabled(): boolean {
    return this.config?.pipeline?.enabled ?? true;
  }

  getCacheTTL(): number {
    return this.config?.risk?.cacheTtlSeconds ?? 300;
  }

  getRiskThresholds(): { high: number; medium: number } {
    return {
      high: this.config?.risk?.highThreshold ?? 0.7,
      medium: this.config?.risk?.mediumThreshold ?? 0.4,
    };
  }

  getStatus() {
    return {
      service: this.serviceName,
      nacos: this.enabled,
      registered: !!this.namingClient,
      config: this.config
        ? {
          pipelineEnabled: this.config.pipeline?.enabled,
          cacheTtlSeconds: this.config.risk?.cacheTtlSeconds,
          riskThresholds: this.getRiskThresholds(),
        }
        : null,
    };
  }
}
