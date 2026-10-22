import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateProdutoDto, ListProdutosDto, UpdateProdutoDto } from './produtos.dto';
import { ProdutosService } from './produtos.service';
import {
  ErrorResponseDto,
  ProdutoResponseDto,
  ProdutosPageResponseDto,
} from '../common/response.dto';
@ApiTags('Produtos')
@Controller('produtos')
@ApiResponse({ status: 400, type: ErrorResponseDto })
@ApiResponse({ status: 404, type: ErrorResponseDto })
@ApiResponse({ status: 500, type: ErrorResponseDto })
export class ProdutosController {
  constructor(private readonly service: ProdutosService) {}
  @Get()
  @ApiOkResponse({ type: ProdutosPageResponseDto })
  @ApiOperation({ summary: 'Listar produtos com busca, filtros, ordenação e paginação' })
  list(@Query() query: ListProdutosDto) {
    return this.service.list(query);
  }
  @Get(':id') @ApiOkResponse({ type: ProdutoResponseDto }) find(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.find(id);
  }
  @Post() @ApiCreatedResponse({ type: ProdutoResponseDto }) async create(
    @Body() dto: CreateProdutoDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const product = await this.service.create(dto);
    response.location(`/api/v1/produtos/${product.id}`);
    return product;
  }
  @Patch(':id') @ApiOkResponse({ type: ProdutoResponseDto }) update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProdutoDto,
  ) {
    return this.service.update(id, dto);
  }
  @Put(':id') @ApiOkResponse({ type: ProdutoResponseDto }) replace(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateProdutoDto,
  ) {
    return this.service.update(id, dto);
  }
  @Delete(':id') @ApiNoContentResponse() @HttpCode(204) remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.remove(id);
  }
}
