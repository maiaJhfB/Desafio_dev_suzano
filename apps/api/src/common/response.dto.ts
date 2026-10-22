import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusPedido } from '../domain/models';
export class ProdutoResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ minLength: 1, maxLength: 120 }) nome!: string;
  @ApiProperty({ minLength: 1, maxLength: 80 }) categoria!: string;
  @ApiProperty({ minLength: 1, maxLength: 2000 }) descricao!: string;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 100000000 }) preco_centavos!: number;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 1000000 }) quantidade_estoque!: number;
  @ApiProperty({ type: String, nullable: true }) imagem_url!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updated_at!: Date;
}
export class ItemPedidoResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) produto_id!: string;
  @ApiProperty({ minLength: 1, maxLength: 120 }) nome_produto!: string;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 100000000 })
  preco_unitario_centavos!: number;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 10000 }) quantidade!: number;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 1000000000000 }) subtotal_centavos!: number;
}
export class PedidoResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: StatusPedido }) status!: StatusPedido;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  total_pedido_centavos!: number;
  @ApiProperty({ type: [ItemPedidoResponseDto] }) produtos!: ItemPedidoResponseDto[];
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updated_at!: Date;
}
export class PaginationResponseDto {
  @ApiProperty({ type: 'integer', minimum: 1 }) pagina!: number;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 }) limite!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) total!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) total_paginas!: number;
}
export class ProdutosPageResponseDto {
  @ApiProperty({ type: [ProdutoResponseDto] }) data!: ProdutoResponseDto[];
  @ApiProperty({ type: PaginationResponseDto }) meta!: PaginationResponseDto;
}
export class PedidosPageResponseDto {
  @ApiProperty({ type: [PedidoResponseDto] }) data!: PedidoResponseDto[];
  @ApiProperty({ type: PaginationResponseDto }) meta!: PaginationResponseDto;
}
export class ErrorDetailDto {
  @ApiProperty() field!: string;
  @ApiProperty() reason!: string;
}
export class ErrorBodyDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ type: [ErrorDetailDto] }) details!: ErrorDetailDto[];
  @ApiProperty({ format: 'uuid' }) request_id!: string;
}
export class ErrorResponseDto {
  @ApiProperty({ type: ErrorBodyDto }) error!: ErrorBodyDto;
}
export class HealthResponseDto {
  @ApiProperty({ enum: ['ok'] }) status!: string;
  @ApiPropertyOptional({ enum: ['ok'] }) database?: string;
}
