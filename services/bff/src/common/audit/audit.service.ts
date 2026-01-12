import { Injectable, Logger } from "@nestjs/common";

/**
 * Event types for audit logging
 */
export enum EventType {
  ADDRESS_QUERY = "ADDRESS_QUERY",
  RISK_QUERY = "RISK_QUERY",
  GRAPH_QUERY = "GRAPH_QUERY",
  ALERT_CREATE = "ALERT_CREATE",
  ALERT_DELETE = "ALERT_DELETE",
  AUTH_LOGIN = "AUTH_LOGIN",
  AUTH_LOGOUT = "AUTH_LOGOUT",
  AUTH_FAILED = "AUTH_FAILED",
  API_REQUEST = "API_REQUEST",
  WEBSOCKET_CONNECT = "WEBSOCKET_CONNECT",
  WEBSOCKET_DISCONNECT = "WEBSOCKET_DISCONNECT",
  CONFIG_CHANGE = "CONFIG_CHANGE",
  RATE_LIMITED = "RATE_LIMITED",
}

/**
 * Action types
 */
export enum Action {
  READ = "READ",
  WRITE = "WRITE",
  DELETE = "DELETE",
  CREATE = "CREATE",
  UPDATE = "UPDATE",
}

/**
 * Status types
 */
export enum Status {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  DENIED = "DENIED",
}

/**
 * Audit event structure
 */
export interface AuditEvent {
  timestamp: string;
  eventType: EventType;
  userId: string;
  ipAddress: string;
  resource: string;
  action: Action;
  status: Status;
  statusCode?: number;
  serviceName: string;
  traceId?: string;
  metadata?: Record<string, any>;
}

/**
 * Audit logging service
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger("AUDIT");
  private readonly serviceName = "bff";

  /**
   * Log an audit event
   */
  log(event: Partial<AuditEvent> & Pick<AuditEvent, "eventType" | "userId" | "ipAddress" | "resource" | "action" | "status">): void {
    const fullEvent: AuditEvent = {
      timestamp: new Date().toISOString(),
      serviceName: this.serviceName,
      ...event,
    };

    const logMessage = JSON.stringify({
      ...fullEvent,
      message: "AUDIT",
    });

    this.logger.log(logMessage);
  }

  /**
   * Log address query
   */
  logAddressQuery(
    userId: string,
    ipAddress: string,
    address: string,
    status: Status,
    responseTimeMs: number,
  ): void {
    this.log({
      eventType: EventType.ADDRESS_QUERY,
      userId,
      ipAddress,
      resource: `/api/v1/addresses/${address}`,
      action: Action.READ,
      status,
      statusCode: status === Status.SUCCESS ? 200 : 500,
      metadata: {
        address,
        response_time_ms: responseTimeMs,
      },
    });
  }

  /**
   * Log risk query
   */
  logRiskQuery(
    userId: string,
    ipAddress: string,
    address: string,
    riskScore: number | null,
    status: Status,
    responseTimeMs: number,
  ): void {
    this.log({
      eventType: EventType.RISK_QUERY,
      userId,
      ipAddress,
      resource: `/api/v1/risk/${address}`,
      action: Action.READ,
      status,
      statusCode: status === Status.SUCCESS ? 200 : 500,
      metadata: {
        address,
        risk_score: riskScore,
        response_time_ms: responseTimeMs,
      },
    });
  }

  /**
   * Log graph query
   */
  logGraphQuery(
    userId: string,
    ipAddress: string,
    address: string,
    queryType: string,
    status: Status,
    responseTimeMs: number,
  ): void {
    this.log({
      eventType: EventType.GRAPH_QUERY,
      userId,
      ipAddress,
      resource: `/api/v1/graph/${address}`,
      action: Action.READ,
      status,
      statusCode: status === Status.SUCCESS ? 200 : 500,
      metadata: {
        address,
        query_type: queryType,
        response_time_ms: responseTimeMs,
      },
    });
  }

  /**
   * Log authentication success
   */
  logLogin(userId: string, ipAddress: string, userAgent?: string): void {
    this.log({
      eventType: EventType.AUTH_LOGIN,
      userId,
      ipAddress,
      resource: "/api/v1/auth/login",
      action: Action.CREATE,
      status: Status.SUCCESS,
      statusCode: 200,
      metadata: {
        user_agent: userAgent,
      },
    });
  }

  /**
   * Log authentication failure
   */
  logLoginFailed(attemptedUser: string, ipAddress: string, reason: string): void {
    this.log({
      eventType: EventType.AUTH_FAILED,
      userId: attemptedUser,
      ipAddress,
      resource: "/api/v1/auth/login",
      action: Action.CREATE,
      status: Status.FAILURE,
      statusCode: 401,
      metadata: {
        failure_reason: reason,
      },
    });
  }

  /**
   * Log logout
   */
  logLogout(userId: string, ipAddress: string): void {
    this.log({
      eventType: EventType.AUTH_LOGOUT,
      userId,
      ipAddress,
      resource: "/api/v1/auth/logout",
      action: Action.DELETE,
      status: Status.SUCCESS,
      statusCode: 200,
    });
  }

  /**
   * Log rate limiting
   */
  logRateLimited(ipAddress: string, resource: string): void {
    this.log({
      eventType: EventType.RATE_LIMITED,
      userId: "anonymous",
      ipAddress,
      resource,
      action: Action.READ,
      status: Status.DENIED,
      statusCode: 429,
      metadata: {
        reason: "rate_limit_exceeded",
      },
    });
  }

  /**
   * Log WebSocket connection
   */
  logWebSocketConnect(userId: string, ipAddress: string, socketId: string): void {
    this.log({
      eventType: EventType.WEBSOCKET_CONNECT,
      userId,
      ipAddress,
      resource: "/alerts",
      action: Action.CREATE,
      status: Status.SUCCESS,
      metadata: {
        socket_id: socketId,
      },
    });
  }

  /**
   * Log WebSocket disconnection
   */
  logWebSocketDisconnect(userId: string, ipAddress: string, socketId: string): void {
    this.log({
      eventType: EventType.WEBSOCKET_DISCONNECT,
      userId,
      ipAddress,
      resource: "/alerts",
      action: Action.DELETE,
      status: Status.SUCCESS,
      metadata: {
        socket_id: socketId,
      },
    });
  }

  /**
   * Log generic API request
   */
  logApiRequest(
    userId: string,
    ipAddress: string,
    method: string,
    path: string,
    statusCode: number,
    responseTimeMs: number,
  ): void {
    const actionMap: Record<string, Action> = {
      GET: Action.READ,
      POST: Action.CREATE,
      PUT: Action.UPDATE,
      PATCH: Action.UPDATE,
      DELETE: Action.DELETE,
    };

    this.log({
      eventType: EventType.API_REQUEST,
      userId: userId || "anonymous",
      ipAddress,
      resource: path,
      action: actionMap[method] || Action.READ,
      status: statusCode < 400 ? Status.SUCCESS : Status.FAILURE,
      statusCode,
      metadata: {
        method,
        response_time_ms: responseTimeMs,
      },
    });
  }
}
