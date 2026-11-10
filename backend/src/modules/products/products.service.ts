import {
  cleanAliases,
  findByPrintedText,
  nameKey,
  type Category,
  type Product,
  type ProductCreate,
  type ProductUpdate,
} from '@gastos/shared';
import type { WriteOptions } from '../../core/db/transaction';
import { DuplicateError, NotFoundError, fieldError } from '../../core/errors/errors';
import type { ProductsRepository } from './products.repository';

export interface ProductsDependencies {
  listCategories(options?: WriteOptions): Promise<Category[]>;
}

export function createProductsService(repository: ProductsRepository, dependencies: ProductsDependencies) {
  async function assertCategory(categoryId: string): Promise<void> {
    const category = (await dependencies.listCategories()).find((candidate) => candidate.id === categoryId);
    if (!category) throw fieldError('categoryId', 'The category does not exist');
    if (category.kind !== 'expense') throw fieldError('categoryId', 'Choose an expense category');
  }

  /** A name or a known text can point at one product only. */
  function assertTextsFree(products: readonly Product[], name: string, aliases: readonly string[], exceptId?: string) {
    if (findByPrintedText(products, name, exceptId)) throw new DuplicateError('Product', 'name');
    for (const alias of aliases) {
      if (findByPrintedText(products, alias, exceptId)) throw new DuplicateError('Product', 'aliases');
    }
  }

  return {
    list: (options: WriteOptions = {}) => repository.findAll(options),

    /** The product a printed text belongs to: by its name or by a known text. */
    async findByText(text: string): Promise<Product | null> {
      return findByPrintedText(await repository.findAll(), text) ?? null;
    },

    async create(input: ProductCreate, options: WriteOptions = {}): Promise<Product> {
      const aliases = cleanAliases(input.name, input.aliases);
      assertTextsFree(await repository.findAll(options), input.name, aliases);
      await assertCategory(input.categoryId);
      return repository.create(
        {
          name: input.name,
          nameKey: nameKey(input.name),
          categoryId: input.categoryId,
          aliases,
          aliasKeys: aliases.map(nameKey),
        },
        options,
      );
    },

    async update(id: string, input: ProductUpdate): Promise<Product> {
      const products = await repository.findAll();
      const current = products.find((product) => product.id === id);
      if (!current) throw new NotFoundError('Product', id);

      const name = input.name ?? current.name;
      const aliases = cleanAliases(name, input.aliases ?? current.aliases);
      const categoryId = input.categoryId ?? current.categoryId;
      assertTextsFree(products, name, aliases, id);
      if (categoryId !== current.categoryId) await assertCategory(categoryId);

      const updated = await repository.update(id, {
        name,
        nameKey: nameKey(name),
        categoryId,
        aliases,
        aliasKeys: aliases.map(nameKey),
        archived: input.archived ?? current.archived,
      });
      if (!updated) throw new NotFoundError('Product', id);
      return updated;
    },

    /** How many products are in the category: it cannot be deleted while any is. */
    countByCategory: repository.countByCategory,
    /** A category merged into another: its products follow it. */
    moveCategory: repository.moveCategory,
  };
}

export type ProductsService = ReturnType<typeof createProductsService>;
