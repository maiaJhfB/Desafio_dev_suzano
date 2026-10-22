import { Body, Controller, Get, Header, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/response.dto';
import { AuthService } from './auth.service';
import { AdminUserResponseDto, LoginDto, LoginResponseDto } from './auth.dto';
import { AdminJwtGuard, AdminRequest } from './auth.guards';
import { LoginRateLimitGuard } from './login-rate-limit';

@ApiTags('Autenticação')
@Controller('auth')
@ApiResponse({ status: 400, type: ErrorResponseDto })
@ApiResponse({ status: 401, type: ErrorResponseDto })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(LoginRateLimitGuard)
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiResponse({
    status: 429,
    type: ErrorResponseDto,
    headers: {
      'Retry-After': {
        schema: { type: 'integer', minimum: 1 },
        description: 'Segundos até uma nova tentativa.',
      },
    },
  })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AdminUserResponseDto })
  me(@Req() request: AdminRequest) {
    return request.authUser!;
  }
}
