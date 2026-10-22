import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  StatusPedido,
  Produto as ProdutoModel,
  Pedido as PedidoModel,
  ItemPedido as ItemPedidoModel,
} from '../domain/models';
export { StatusPedido } from '../domain/models';
const safeIntegerTransformer = {
  to: (value: number) => {
    if (!Number.isSafeInteger(value)) throw new Error('Valor monetário fora da precisão segura.');
    return value;
  },
  from: (value: string) => {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new Error('Valor monetário fora da precisão segura.');
    return parsed;
  },
};

@Entity('produtos')
@Check('ck_produtos_preco', 'preco_centavos BETWEEN 0 AND 100000000')
@Check('ck_produtos_estoque', 'quantidade_estoque BETWEEN 0 AND 1000000')
export class Produto implements ProdutoModel {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ length: 120 }) nome!: string;
  @Column({ length: 80 }) categoria!: string;
  @Column({ type: 'text' }) descricao!: string;
  @Column({ type: 'integer' }) preco_centavos!: number;
  @Column({ type: 'integer' }) quantidade_estoque!: number;
  @Column({ type: 'varchar', length: 2048, nullable: true }) imagem_url!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @DeleteDateColumn({ type: 'timestamptz', select: false }) excluido_em!: Date | null;
}

@Entity('pedidos')
@Check('ck_pedidos_total', 'total_pedido_centavos >= 0')
export class Pedido implements PedidoModel {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'enum', enum: StatusPedido, enumName: 'status_pedido' }) status!: StatusPedido;
  // bigint can exceed JS safe arithmetic for large baskets. Transform only values validated by service.
  @Column({ type: 'bigint', transformer: safeIntegerTransformer }) total_pedido_centavos!: number;
  @OneToMany(() => ItemPedido, (item) => item.pedido, { cascade: ['insert'] }) itens!: ItemPedido[];
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}

@Entity('itens_pedido')
@Check('ck_itens_quantidade', 'quantidade BETWEEN 1 AND 10000')
export class ItemPedido implements ItemPedidoModel {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') pedido_id!: string;
  @ManyToOne(() => Pedido, (pedido) => pedido.itens, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pedido_id' })
  pedido!: Pedido;
  @Column('uuid') produto_id!: string;
  @ManyToOne(() => Produto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'produto_id' })
  produto!: Produto;
  @Column({ length: 120 }) nome_produto!: string;
  @Column({ type: 'integer' }) preco_unitario_centavos!: number;
  @Column({ type: 'integer' }) quantidade!: number;
  @Column({ type: 'bigint', transformer: safeIntegerTransformer }) subtotal_centavos!: number;
}
