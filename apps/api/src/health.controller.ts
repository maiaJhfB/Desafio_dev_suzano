import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { ApiError } from './common/errors';
import { HealthResponseDto } from './common/response.dto';
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly source: DataSource) {}
  @Get('live') @ApiOkResponse({ type: HealthResponseDto }) live() {
    return { status: 'ok' };
  }
  @Get('ready') @ApiOkResponse({ type: HealthResponseDto }) async ready() {
    try {
      await this.source.query('SELECT 1');
      return { status: 'ok', database: 'ok' };
    } catch {
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'O banco de dados não está disponível.');
    }
  }
}
