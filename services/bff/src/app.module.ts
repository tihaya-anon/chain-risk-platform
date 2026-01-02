import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AddressModule } from "./modules/address/address.module";
import { RiskModule } from "./modules/risk/risk.module";
import { AuthModule } from "./modules/auth/auth.module";
import { GraphModule } from "./modules/graph/graph.module";
import { NacosService } from "./common/nacos.service";
import { getConfig } from "./config/config";

const config = getConfig();

@Module({
  imports: [
    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: config.rateLimit.ttl,
        limit: config.rateLimit.limit,
      },
    ]),
    // Feature modules
    AuthModule,
    AddressModule,
    RiskModule,
    GraphModule,
  ],
  providers: [
    // Nacos service for service discovery and config
    NacosService,
    // Global rate limit guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [NacosService],
})
export class AppModule {}
