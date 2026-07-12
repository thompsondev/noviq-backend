import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { capitalizedMessage } from '../../helpers';
import { CustomLoggerService } from 'src/lib/loggger/logger.service';

/** Postgres error shape surfaced on TypeORM's QueryFailedError.driverError */
type PgDriverError = {
  code?: string;
  constraint?: string;
  column?: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: CustomLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status: number;
    let message: any;
    let statusType: string;

    // Handle TypeORM query errors (wraps the underlying Postgres error)
    if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      message = this.handleQueryFailedError(exception);
      statusType = HttpStatus[HttpStatus.BAD_REQUEST] || 'Bad Request';
    } else if (exception instanceof HttpException) {
      // Handle standard HTTP exceptions
      status = exception.getStatus();
      const responseMessage = exception.getResponse();
      message =
        typeof responseMessage === 'string'
          ? responseMessage
          : (responseMessage as any).message || 'Unknown error';
      statusType = HttpStatus[status] || 'Unknown Error';
    } else if (exception instanceof Error) {
      // Check if it's a Stripe error by checking the error properties
      // Stripe errors have specific properties like 'type', 'code', or constructor name
      const error = exception as any;
      const isStripeError =
        error.type?.startsWith('Stripe') ||
        error.code?.startsWith('card_') ||
        error.code?.startsWith('payment_') ||
        error.code?.startsWith('invalid_') ||
        error.constructor?.name === 'StripeAPIError' ||
        error.constructor?.name === 'StripeCardError' ||
        error.constructor?.name === 'StripeInvalidRequestError' ||
        error.constructor?.name?.includes('Stripe');

      if (isStripeError) {
        // Handle Stripe errors - return the actual error message
        status = HttpStatus.BAD_REQUEST;
        message = exception.message || 'Payment processing error';
        statusType = HttpStatus[HttpStatus.BAD_REQUEST] || 'Bad Request';
      } else {
        // Generic error — log the real message internally but never send it to the client
        // (error messages can contain DATABASE_URL, API keys, or other secrets)
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Internal server error';
        statusType = 'Internal Server Error';
      }
    } else {
      // Handle other exceptions (e.g. Internal Server Error)
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      statusType = 'Internal Server Error';
    }

    // Create the error response object, including timestamp and path
    const errorResponse = {
      statusCode: status,
      statusType,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log the error using the custom logger
    this.logger.error(
      `Exception: ${JSON.stringify(errorResponse)}`,
      exception instanceof Error ? (exception.stack ?? '') : '',
    );

    // Send the structured error response to the client
    response.status(status).json(errorResponse);
  }

  // Handle Postgres errors surfaced via TypeORM and provide meaningful messages
  private handleQueryFailedError(exception: QueryFailedError): string {
    const driverError = exception.driverError as PgDriverError;
    switch (driverError?.code) {
      case '23505': // unique_violation
        return `${capitalizedMessage(driverError.constraint ?? '')} already exists`;
      case '23503': // foreign_key_violation
        return `${capitalizedMessage(driverError.constraint ?? '')} key relationship not found`;
      default: // Database error
        return 'Database error occurred';
    }
  }
}
