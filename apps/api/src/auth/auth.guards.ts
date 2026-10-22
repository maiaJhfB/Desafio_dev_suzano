import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { StatusPedido } from '../domain/models';
import { AuthService } from './auth.service';
import { AdminUserResponseDto } from './auth.dto';

export interface AdminRequest extends Request {
  authUser?: AdminUserResponseDto;
}

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    request.authUser = await this.auth.authenticate(request.headers.authorization);
    return true;
  }
}

@Injectable()
export class CheckoutJwtGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const body: unknown = request.body;
    const creatingCompleted =
      body !== null &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      'status' in body &&
      body.status === StatusPedido.Concluido;
    if (request.headers.authorization !== undefined || creatingCompleted) {
      request.authUser = await this.auth.authenticate(request.headers.authorization);
    }
    return true;
  }
}
