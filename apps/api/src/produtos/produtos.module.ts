import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Produto } from '../database/entities';
import { ProdutosController } from './produtos.controller';
import { ProdutosService } from './produtos.service';
import { ProdutosStore } from './produtos.ports';
import { ProdutosRepository } from './produtos.repository';
@Module({
  imports: [TypeOrmModule.forFeature([Produto])],
  controllers: [ProdutosController],
  providers: [ProdutosService, { provide: ProdutosStore, useClass: ProdutosRepository }],
})
export class ProdutosModule {}
