import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "./app.module";
import { NacosService } from "./common/nacos.service";
import { AuditService } from "./common/audit/audit.service";
import { AuditInterceptor } from "./common/audit/audit.interceptor";
import { AlertsGateway } from "./modules/websocket/alerts.gateway";
import { AlertPushService } from "./modules/websocket/alert-push.service";
import { getConfig } from "./config/config";
import { loadTLSConfig, createHttpsOptions, NestHttpsOptions } from "./config/tls";
import { logger } from "./common/logger";

async function bootstrap() {
  const config = getConfig();
  const tlsConfig = loadTLSConfig();

  // Create app - TLS configured via NestJS options
  const httpsOptions = tlsConfig.enabled
    ? (createHttpsOptions(tlsConfig) as any)
    : undefined;

  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
    httpsOptions,
  });

  // WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Global prefix
  app.setGlobalPrefix("api/v1");

  // CORS
  app.enableCors({
    origin: config.cors.origins,
    credentials: config.cors.credentials,
  });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global audit interceptor
  const auditService = app.get(AuditService);
  app.useGlobalInterceptors(new AuditInterceptor(auditService));

  // Admin endpoints
  const httpAdapter = app.getHttpAdapter();
  const nacosService = app.get(NacosService);
  const alertsGateway = app.get(AlertsGateway);
  const alertPushService = app.get(AlertPushService);

  httpAdapter.get("/admin/status", (req: any, res: any) => {
    res.json({
      ...nacosService.getStatus(),
      status: "healthy",
      tls_enabled: tlsConfig.enabled,
      timestamp: Date.now(),
    });
  });

  httpAdapter.get("/health", (req: any, res: any) => {
    res.json({
      status: "ok",
      tls_enabled: tlsConfig.enabled,
    });
  });

  // WebSocket stats endpoint
  httpAdapter.get("/admin/ws/stats", (req: any, res: any) => {
    res.json(alertsGateway.getStats());
  });

  // Alert push service status
  httpAdapter.get("/admin/alerts/status", (req: any, res: any) => {
    res.json(alertPushService.getStatus());
  });

  // Test alert endpoint (for debugging)
  httpAdapter.post("/admin/alerts/test", (req: any, res: any) => {
    const body = req.body || {};
    alertPushService.pushManualAlert({
      type: body.type || "test",
      severity: body.severity || "low",
      entityType: body.entityType || "address",
      entityId: body.entityId || "0x" + "0".repeat(40),
      title: body.title || "Test Alert",
      message: body.message || "This is a test alert",
      riskScore: body.riskScore,
      address: body.address,
      metadata: body.metadata,
    });
    res.json({ success: true, message: "Test alert pushed" });
  });

  // Swagger documentation (only in non-production)
  if (config.server.env !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Chain Risk Platform - BFF")
      .setDescription("BFF API for Chain Risk Platform")
      .setVersion("1.0")
      .addBearerAuth()
      .addTag("auth", "Authentication endpoints")
      .addTag("addresses", "Address query endpoints")
      .addTag("risk", "Risk scoring endpoints")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);

    logger.info("Swagger UI enabled", { url: "/docs" });
  }

  const port = config.server.port;
  await app.listen(port);

  logger.info("BFF started", {
    name: config.server.name,
    port: port,
    env: config.server.env,
    tls_enabled: tlsConfig.enabled,
    nacos: nacosService.isEnabled(),
    websocket: {
      namespace: "/alerts",
      enabled: true,
    },
    alertPush: {
      enabled: true,
    },
  });
}

bootstrap();
