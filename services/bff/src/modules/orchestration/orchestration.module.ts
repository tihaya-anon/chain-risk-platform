import { Module } from "@nestjs/common";
import { OrchestrationController } from "./orchestration.controller";
import { OrchestrationService } from "./orchestration.service";
import { AddressModule } from "../address/address.module";
import { RiskModule } from "../risk/risk.module";
import { GraphModule } from "../graph/graph.module";
import { AlertModule } from "../alert/alert.module";

@Module({
  imports: [AddressModule, RiskModule, GraphModule, AlertModule],
  controllers: [OrchestrationController],
  providers: [OrchestrationService],
  exports: [OrchestrationService],
})
export class OrchestrationModule {}
