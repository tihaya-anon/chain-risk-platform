import { Module } from "@nestjs/common";
import { AlertController } from "./alert.controller";
import { AlertService } from "./alert.service";
import { RolesGuard } from "../../common/guards";

@Module({
  controllers: [AlertController],
  providers: [AlertService, RolesGuard],
  exports: [AlertService],
})
export class AlertModule {}
