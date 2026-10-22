import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SortDto, Trim } from '../common/dto';
import { CreateProdutoInput, UpdateProdutoInput, ListProdutosQuery } from '../domain/commands';

export class CreateProdutoDto implements CreateProdutoInput {
  @ApiProperty({ minLength: 1, maxLength: 120, pattern: '\\S' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;
  @ApiProperty({ minLength: 1, maxLength: 80, pattern: '\\S' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  categoria!: string;
  @ApiProperty({ minLength: 1, maxLength: 2000, pattern: '\\S' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  descricao!: string;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 100000000 })
  @IsInt()
  @Min(0)
  @Max(100000000)
  preco_centavos!: number;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 1000000 })
  @IsInt()
  @Min(0)
  @Max(1000000)
  quantidade_estoque!: number;
  @ApiPropertyOptional({
    type: String,
    format: 'uri',
    pattern: '^https?://',
    nullable: true,
    maxLength: 2048,
  })
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
    disallow_auth: true,
  })
  @MaxLength(2048)
  imagem_url?: string | null;
}
export class UpdateProdutoDto
  extends PartialType(CreateProdutoDto, {
    skipNullProperties: false,
  })
  implements UpdateProdutoInput {}
export class ListProdutosDto extends SortDto implements ListProdutosQuery {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  nome?: string;
  @ApiPropertyOptional({
    description: 'Categoria exata do produto.',
    minLength: 1,
    maxLength: 80,
    pattern: '\\S',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  categoria?: string;
  @ApiPropertyOptional({ type: 'integer', minimum: 0, maximum: 100000000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  preco_min_centavos?: number;
  @ApiPropertyOptional({ type: 'integer', minimum: 0, maximum: 100000000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  preco_max_centavos?: number;
  @ApiPropertyOptional({ enum: ['nome', 'preco', 'criado_em'], default: 'criado_em' })
  @IsOptional()
  @IsIn(['nome', 'preco', 'criado_em'])
  ordenar: 'nome' | 'preco' | 'criado_em' = 'criado_em';
}
