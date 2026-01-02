import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { NacosService } from "./common/nacos.service";
import { getConfig } from "./config/config";
import { logger } from "./common/logger";

async function bootstrap() {
  const config = getConfig();

  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  // Global prefix
  app.setGlobalPrefix("api/v1");

  // Validation pipe
  app.enableCors({
    origin: config.cors.origins,
    credentials: config.cors.credentials,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Admin status endpoint
  const httpAdapter = app.getHttpAdapter();
  const nacosService = app.get(NacosService);

  httpAdapter.get("/admin/status", (req, res) => {
    res.json({
      ...nacosService.getStatus(),
      status: "healthy",
      timestamp: Date.now(),
    });
  });

  httpAdapter.get("/health", (req, res) => {
    res.json({ status: "ok" });
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

  await app.listen(config.server.port);

  logger.info("BFF started", {
    name: config.server.name,
    port: config.server.port,
    env: config.server.env,
    nacos: nacosService.isEnabled(),
  });
}

bootstrap();
