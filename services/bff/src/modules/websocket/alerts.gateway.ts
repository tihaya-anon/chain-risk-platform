import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { logger } from '../../common/logger';

interface SubscriptionPayload {
  addresses?: string[];
  riskThreshold?: number;
  alertTypes?: string[];
}

interface ClientSubscription {
  clientId: string;
  addresses: Set<string>;
  riskThreshold: number;
  alertTypes: Set<string>;
  subscribedAt: Date;
}

@WebSocketGateway({
  namespace: '/alerts',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class AlertsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private clients: Map<string, ClientSubscription> = new Map();
  private addressSubscribers: Map<string, Set<string>> = new Map();

  afterInit() {
    logger.info('WebSocket Gateway initialized', { namespace: '/alerts' });
  }

  handleConnection(client: Socket) {
    const clientId = client.id;
    logger.info('WebSocket client connected', {
      clientId,
      transport: client.conn.transport.name,
    });

    // Initialize client subscription
    this.clients.set(clientId, {
      clientId,
      addresses: new Set(),
      riskThreshold: 0,
      alertTypes: new Set(['all']),
      subscribedAt: new Date(),
    });

    // Send welcome message
    client.emit('connected', {
      clientId,
      message: 'Connected to alerts gateway',
      timestamp: Date.now(),
    });
  }

  handleDisconnect(client: Socket) {
    const clientId = client.id;
    logger.info('WebSocket client disconnected', { clientId });

    // Clean up subscriptions
    const subscription = this.clients.get(clientId);
    if (subscription) {
      for (const address of subscription.addresses) {
        const subscribers = this.addressSubscribers.get(address);
        if (subscribers) {
          subscribers.delete(clientId);
          if (subscribers.size === 0) {
            this.addressSubscribers.delete(address);
          }
        }
      }
    }
    this.clients.delete(clientId);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscriptionPayload,
  ) {
    const clientId = client.id;
    const subscription = this.clients.get(clientId);

    if (!subscription) {
      return { success: false, error: 'Client not found' };
    }

    // Update subscription
    if (payload.addresses) {
      for (const address of payload.addresses) {
        const normalizedAddress = address.toLowerCase();
        subscription.addresses.add(normalizedAddress);

        // Track address subscribers
        if (!this.addressSubscribers.has(normalizedAddress)) {
          this.addressSubscribers.set(normalizedAddress, new Set());
        }
        this.addressSubscribers.get(normalizedAddress)!.add(clientId);
      }
    }

    if (payload.riskThreshold !== undefined) {
      subscription.riskThreshold = payload.riskThreshold;
    }

    if (payload.alertTypes) {
      subscription.alertTypes = new Set(payload.alertTypes);
    }

    logger.info('Client subscribed', {
      clientId,
      addresses: Array.from(subscription.addresses),
      riskThreshold: subscription.riskThreshold,
      alertTypes: Array.from(subscription.alertTypes),
    });

    return {
      success: true,
      subscription: {
        addresses: Array.from(subscription.addresses),
        riskThreshold: subscription.riskThreshold,
        alertTypes: Array.from(subscription.alertTypes),
      },
    };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { addresses?: string[] },
  ) {
    const clientId = client.id;
    const subscription = this.clients.get(clientId);

    if (!subscription) {
      return { success: false, error: 'Client not found' };
    }

    if (payload.addresses) {
      for (const address of payload.addresses) {
        const normalizedAddress = address.toLowerCase();
        subscription.addresses.delete(normalizedAddress);

        const subscribers = this.addressSubscribers.get(normalizedAddress);
        if (subscribers) {
          subscribers.delete(clientId);
          if (subscribers.size === 0) {
            this.addressSubscribers.delete(normalizedAddress);
          }
        }
      }
    } else {
      // Unsubscribe from all
      for (const address of subscription.addresses) {
        const subscribers = this.addressSubscribers.get(address);
        if (subscribers) {
          subscribers.delete(clientId);
          if (subscribers.size === 0) {
            this.addressSubscribers.delete(address);
          }
        }
      }
      subscription.addresses.clear();
    }

    logger.info('Client unsubscribed', {
      clientId,
      remainingAddresses: Array.from(subscription.addresses),
    });

    return {
      success: true,
      subscription: {
        addresses: Array.from(subscription.addresses),
      },
    };
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { event: 'pong', timestamp: Date.now() };
  }

  // Methods for pushing alerts (called from AlertPushService)
  broadcastAlert(alert: any) {
    this.server.emit('alert', alert);
    logger.debug('Broadcast alert to all clients', { alertId: alert.id });
  }

  pushAlertToAddress(address: string, alert: any) {
    const normalizedAddress = address.toLowerCase();
    const subscribers = this.addressSubscribers.get(normalizedAddress);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    for (const clientId of subscribers) {
      const subscription = this.clients.get(clientId);
      if (!subscription) continue;

      // Check risk threshold
      if (
        alert.riskScore !== undefined &&
        alert.riskScore < subscription.riskThreshold
      ) {
        continue;
      }

      // Check alert type filter
      if (
        !subscription.alertTypes.has('all') &&
        alert.type &&
        !subscription.alertTypes.has(alert.type)
      ) {
        continue;
      }

      this.server.to(clientId).emit('alert', alert);
    }

    logger.debug('Pushed alert to address subscribers', {
      address: normalizedAddress,
      subscriberCount: subscribers.size,
      alertId: alert.id,
    });
  }

  pushAlertToClient(clientId: string, alert: any) {
    this.server.to(clientId).emit('alert', alert);
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      trackedAddresses: this.addressSubscribers.size,
      subscriptions: Array.from(this.clients.values()).map((sub) => ({
        clientId: sub.clientId,
        addressCount: sub.addresses.size,
        riskThreshold: sub.riskThreshold,
        subscribedAt: sub.subscribedAt,
      })),
    };
  }
}
