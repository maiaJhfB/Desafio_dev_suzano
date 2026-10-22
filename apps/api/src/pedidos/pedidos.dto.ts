import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsObject,
  IsUUID,
  Max,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '../common/dto';
import { StatusPedido } from '../domain/models';
import {
  ItemPedidoInput,
  CreatePedidoInput,
  UpdateStatusInput,
  ListPedidosQuery,
} from '../domain/commands';
export class ItemPedidoDto implements ItemPedidoInput {
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsUUID()
  produto_id!: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 10000 })
  @IsInt()
  @Min(1)
  @Max(10000)
  quantidade!: number;
}
export class CreatePedidoDto implements CreatePedidoInput {
  @ApiProperty({ type: [ItemPedidoDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((item: ItemPedidoDto | null | undefined) => item?.produto_id)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  produtos!: ItemPedidoDto[];
  @ApiPropertyOptional({
    enum: [StatusPedido.Pendente, StatusPedido.Concluido],
    default: StatusPedido.Pendente,
    nullable: false,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn([StatusPedido.Pendente, StatusPedido.Concluido])
  status?: StatusPedido.Pendente | StatusPedido.Concluido;
}
export class UpdateStatusDto implements UpdateStatusInput {
  @ApiProperty({ enum: [StatusPedido.Concluido, StatusPedido.Cancelado] })
  @IsIn([StatusPedido.Concluido, StatusPedido.Cancelado])
  status!: StatusPedido.Concluido | StatusPedido.Cancelado;
}
export class ListPedidosDto extends PaginationDto implements ListPedidosQuery {
  @ApiPropertyOptional({ enum: StatusPedido })
  @IsOptional()
  @IsEnum(StatusPedido)
  status?: StatusPedido;
}
