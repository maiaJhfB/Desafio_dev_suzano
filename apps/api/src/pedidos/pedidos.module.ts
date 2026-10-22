import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { PedidosStore } from './pedidos.ports';
import { PostgresPedidosStore } from './pedidos.repository';
@Module({
  controllers: [PedidosController],
  providers: [PedidosService, { provide: PedidosStore, useClass: PostgresPedidosStore }],
})
export class PedidosModule {}
