import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status: number;
    let message: string;

    if (e instanceof HttpException) {
      status = e.getStatus();
      message = e.message;
    } else {
      status = typeof (e as any)?.status === 'number' ? (e as any).status : 500;
      message = e instanceof Error ? e.message : 'Internal server error';
    }

    res.status(status).json({ message });
  }
}
