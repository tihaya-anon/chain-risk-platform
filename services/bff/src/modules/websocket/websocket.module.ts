import { Module, Global } from '@nestjs/common';
import { AlertsGateway } from './alerts.gateway';
import { AlertPushService } from './alert-push.service';

@Global()
@Module({
  providers: [AlertsGateway, AlertPushService],
  exports: [AlertsGateway, AlertPushService],
})
export class WebsocketModule {}
