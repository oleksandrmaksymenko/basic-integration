import {z} from 'zod';
import {companyRepository} from '@/repositories';

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  userId: z.string().uuid(),
});

const updateSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const companyService = {
  getAll: () => companyRepository.findAll(),

  async getById(id: string) {
    const company = await companyRepository.findById(id);
    if (!company) throw Object.assign(new Error('Company not found'), {status: 404});
    return company;
  },

  async create(input: unknown) {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success)
      throw Object.assign(new Error(JSON.stringify(parsed.error.flatten())), {status: 400});
    return companyRepository.create(parsed.data);
  },

  async update(input: unknown) {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success)
      throw Object.assign(new Error(JSON.stringify(parsed.error.flatten())), {status: 400});
    const {companyId, ...data} = parsed.data;
    return companyRepository.update(companyId, data);
  },

  remove: (id: string) => companyRepository.remove(id),
};
