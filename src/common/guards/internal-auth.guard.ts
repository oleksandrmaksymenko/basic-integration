import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (req.headers['x-webhook-secret'] !== process.env.INTERNAL_WEBHOOK_SECRET) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
