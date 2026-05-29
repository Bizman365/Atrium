import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal server error";
    let error = "Internal Server Error";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const obj = res as Record<string, unknown>;
        message = (obj.message as string) ?? message;
        error = (obj.error as string) ?? error;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error("Unknown exception", exception);
    }

    const url = request.originalUrl || request.url || "";
    if (url.startsWith("/api/agent")) {
      response.status(statusCode).json({
        ok: false,
        error: {
          code: agentErrorCode(statusCode),
          message: Array.isArray(message) ? "Validation failed" : message,
          details: Array.isArray(message) ? message : undefined,
        },
      });
      return;
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
    });
  }
}

function agentErrorCode(statusCode: number): string {
  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
      return "VALIDATION_ERROR";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    default:
      return "INTERNAL_ERROR";
  }
}
