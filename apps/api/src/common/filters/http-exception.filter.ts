import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ZodError } from "zod";
import { logger } from "@ai-hiring-platform/logger";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "An unexpected error occurred";
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === "string") {
        message = payload;
      } else if (typeof payload === "object" && payload) {
        const body = payload as Record<string, unknown>;
        message = String(body.message ?? exception.message);
        code = String(body.code ?? exception.name);
        details = body.details;
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = "VALIDATION_ERROR";
      message = "Invalid input data";
      details = exception.flatten();
    }

    if (status >= 500) {
      logger.error("Unhandled API error", {
        path: request.url,
        method: request.method,
        message: exception instanceof Error ? exception.message : "Unknown error",
      });
    }

    response.status(status).json({
      success: false,
      error: { code, message, details },
    });
  }
}
