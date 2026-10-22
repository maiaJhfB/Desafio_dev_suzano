import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreatePedidoDto, ListPedidosDto, UpdateStatusDto } from './pedidos.dto';
import { PedidosService } from './pedidos.service';
import { presentPedido } from './pedidos.presenter';
import { IdempotencyKey } from './idempotency-key.pipe';
import { AdminJwtGuard, CheckoutJwtGuard } from '../auth/auth.guards';
import {
  ErrorResponseDto,
  PedidoResponseDto,
  PedidosPageResponseDto,
} from '../common/response.dto';
@ApiTags('Pedidos')
@Controller('pedidos')
@ApiResponse({ status: 400, type: ErrorResponseDto })
@ApiResponse({ status: 404, type: ErrorResponseDto })
@ApiResponse({ status: 409, type: ErrorResponseDto })
@ApiResponse({ status: 503, type: ErrorResponseDto })
@ApiResponse({ status: 500, type: ErrorResponseDto })
export class PedidosController {
  constructor(private readonly service: PedidosService) {}
  @Get()
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 401, type: ErrorResponseDto })
  @ApiOkResponse({ type: PedidosPageResponseDto })
  async list(@Query() query: ListPedidosDto) {
    const response = await this.service.list(query);
    return { ...response, data: response.data.map(presentPedido) };
  }
  @Get(':id')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 401, type: ErrorResponseDto })
  @ApiOkResponse({ type: PedidoResponseDto })
  async find(@Param('id', new ParseUUIDPipe()) id: string) {
    return presentPedido(await this.service.find(id));
  }
  @Post()
  @UseGuards(CheckoutJwtGuard)
  @ApiResponse({ status: 401, type: ErrorResponseDto })
  @ApiCreatedResponse({
    type: PedidoResponseDto,
    headers: {
      Location: { description: 'Caminho do pedido criado.', schema: { type: 'string' } },
      'Idempotency-Replayed': {
        description: 'true quando a resposta original foi recuperada.',
        schema: { type: 'string', enum: ['true', 'false'] },
      },
    },
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    schema: { type: 'string', format: 'uuid' },
    description:
      'UUID opcional para repetir uma criação com segurança. A mesma chave e os mesmos produtos/quantidades/status retornam a resposta original (201), sem criar outro pedido. Reutilização com dados diferentes retorna 409. As chaves bem-sucedidas permanecem persistidas; falhas não consomem a chave.',
  })
  @ApiOperation({
    summary: 'Criar pedido calculando preços e total no servidor',
    description:
      'Checkout Pendente é público. Criar Concluído exige Bearer JWT de administrador. Se Authorization for informado, o token é validado em qualquer status.',
    security: [{}, { bearer: [] }],
  })
  async create(
    @Body() dto: CreatePedidoDto,
    @Res({ passthrough: true }) response: Response,
    @IdempotencyKey() idempotencyKey?: string,
  ) {
    const result = await this.service.create(dto, idempotencyKey);
    const order = presentPedido(result.pedido);
    response.location(`/api/v1/pedidos/${order.id}`);
    response.setHeader('Idempotency-Replayed', String(result.replayed));
    return order;
  }
  @Patch(':id/status')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 401, type: ErrorResponseDto })
  @ApiOkResponse({ type: PedidoResponseDto })
  @ApiOperation({ summary: 'Concluir ou cancelar um pedido pendente' })
  async updateStatus(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateStatusDto) {
    return presentPedido(await this.service.updateStatus(id, dto));
  }
}
