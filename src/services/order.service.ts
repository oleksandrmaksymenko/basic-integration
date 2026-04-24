import {z} from 'zod';
import {orderRepository} from '@/repositories';

const createSchema = z.object({
  total: z.number().positive(),
  companyId: z.string().uuid(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
});

const updateSchema = z.object({
  total: z.number().positive().optional(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
});

export const orderService = {
  getAll: () => orderRepository.findAll(),

  getByCompany: (companyId: string) => orderRepository.findByCompany(companyId),

  async getById(id: string) {
    const order = await orderRepository.findById(id);
    if (!order) throw Object.assign(new Error('Order not found'), {status: 404});
    return order;
  },

  async create(input: unknown) {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success)
      throw Object.assign(new Error(JSON.stringify(parsed.error.flatten())), {status: 400});
    return orderRepository.create(parsed.data);
  },

  async update(id: string, input: unknown) {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success)
      throw Object.assign(new Error(JSON.stringify(parsed.error.flatten())), {status: 400});
    return orderRepository.update(id, parsed.data);
  },

  remove: (id: string) => orderRepository.remove(id),
};
