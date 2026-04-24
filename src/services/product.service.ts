import {z} from 'zod';
import {productRepository} from '@/repositories';

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  companyId: z.string().uuid(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
});

export const productService = {
  getAll: () => productRepository.findAll(),

  async getById(id: string) {
    const product = await productRepository.findById(id);
    if (!product) throw Object.assign(new Error('Product not found'), {status: 404});
    return product;
  },

  async create(input: unknown) {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success)
      throw Object.assign(new Error(JSON.stringify(parsed.error.flatten())), {status: 400});
    return productRepository.create(parsed.data);
  },

  async update(id: string, input: unknown) {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success)
      throw Object.assign(new Error(JSON.stringify(parsed.error.flatten())), {status: 400});
    return productRepository.update(id, parsed.data);
  },

  remove: (id: string) => productRepository.remove(id),
};
