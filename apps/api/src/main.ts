import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { logger } from "@ai-hiring-platform/logger";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { originProtection } from "./common/middleware/origin-protection.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false, rawBody: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.use(cookieParser());

  const frontendUrl = config.get<string>("FRONTEND_URL") ?? "http://localhost:3000";
  app.use(originProtection(frontendUrl));
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Organization-Id"],
  });

  const openApiConfig = new DocumentBuilder()
    .setTitle("AI Hiring Intelligence API")
    .setDescription("Recruiter, candidate interview, evaluation, billing, and platform operations API")
    .setVersion("1.0")
    .addCookieAuth("access_token")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, openApiConfig), {
    jsonDocumentUrl: "api/docs/openapi.json",
  });

  app.enableShutdownHooks();

  const port = Number(config.get("PORT") ?? 4000);
  await app.listen(port);
  logger.info("API started", { port, frontendUrl });
}

bootstrap();
