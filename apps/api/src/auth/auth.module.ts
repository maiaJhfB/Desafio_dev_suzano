import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AUTH_CONFIG, readAuthConfig } from './auth.config';
import { AuthService } from './auth.service';
import { AdminJwtGuard, CheckoutJwtGuard } from './auth.guards';
import { LoginRateLimiter, LoginRateLimitGuard } from './login-rate-limit';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: () => readAuthConfig() },
    AuthService,
    AdminJwtGuard,
    CheckoutJwtGuard,
    LoginRateLimiter,
    LoginRateLimitGuard,
  ],
  exports: [AuthService, AdminJwtGuard, CheckoutJwtGuard],
})
export class AuthModule {}
