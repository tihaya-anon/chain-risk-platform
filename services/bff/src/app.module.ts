import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AddressModule } from "./modules/address/address.module";
import { RiskModule } from "./modules/risk/risk.module";
import { AuthModule } from "./modules/auth/auth.module";
import { GraphModule } from "./modules/graph/graph.module";
import { TransfersModule } from "./modules/transfers/transfers.module";
import { AlertModule } from "./modules/alert/alert.module";
import { WebsocketModule } from "./modules/websocket/websocket.module";
import { OrchestrationModule } from "./modules/orchestration/orchestration.module";
import { NacosService } from "./common/nacos.service";
import { AuditService } from "./common/audit/audit.service";
import { AuditInterceptor } from "./common/audit/audit.interceptor";
import { RateLimitGuard } from "./common/guards/rate-limit.guard";
import { getConfig } from "./config/config";

const config = getConfig();

@Module({
  imports: [
    // Rate limiting (using @nestjs/throttler as backup)
    ThrottlerModule.forRoot([
      {
        ttl: config.rateLimit.ttl,
        limit: config.rateLimit.limit,
      },
    ]),
    // WebSocket module
    WebsocketModule,
    // Feature modules
    AuthModule,
    AddressModule,
    TransfersModule,
    RiskModule,
    GraphModule,
    AlertModule,
    // Orchestration module (migrated from Java orchestrator)
    OrchestrationModule,
  ],
  providers: [
    // Nacos service for service discovery and config
    NacosService,
    // Audit service for security logging
    AuditService,
    // Custom rate limit guard (route-specific limits)
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    // Audit interceptor for request logging
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [NacosService, AuditService],
})
export class AppModule {}
