import source from './data-source';
import { Produto } from './entities';
import { loadStoreProducts } from './store-products';

export const seedProdutos = loadStoreProducts();

async function seed() {
  await source.initialize();
  try {
    // Re-running the seed preserves stock, edits, soft deletions and existing orders.
    await source
      .getRepository(Produto)
      .createQueryBuilder()
      .insert()
      .values(
        seedProdutos.map((produto, index) => {
          const timestamp = new Date(Date.UTC(2026, 9, 20 - index, 12));
          return { ...produto, created_at: timestamp, updated_at: timestamp };
        }),
      )
      .orIgnore()
      .execute();
    console.log(`Seed conferido: ${seedProdutos.length} produtos Suzano de demonstração.`);
  } finally {
    await source.destroy();
  }
}
if (require.main === module)
  void seed().catch((error) => {
    console.error(`Falha no seed: ${error instanceof Error ? error.name : 'Unknown'}`);
    process.exitCode = 1;
  });
