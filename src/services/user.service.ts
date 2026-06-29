import {z} from 'zod';
import bcrypt from 'bcryptjs';
import {userRepository, userSettingsRepository, companyRepository} from '@/repositories';

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(['MANAGER', 'OWNER', 'ADMIN', 'CUSTOMER']).optional(),
});

const updateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
});

const setActiveCompanySchema = z.object({
  userId: z.string().uuid(),
  companyId: z.string().uuid(),
});

export const userService = {
  getAll: () => userRepository.findAll(),

  async getById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw Object.assign(new Error('User not found'), {status: 404});
    return user;
  },

  async create(input: unknown) {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success)
      throw Object.assign(new Error(JSON.stringify(parsed.error.flatten())), {status: 400});
    const {password, ...rest} = parsed.data;
    return userRepository.create({...rest, password: await bcrypt.hash(password, 10)});
  },

  async update(id: string, input: unknown) {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success)
      throw Object.assign(new Error(JSON.stringify(parsed.error.flatten())), {status: 400});
    return userRepository.update(id, parsed.data);
  },

  remove: (id: string) => userRepository.remove(id),

  async setActiveCompany(input: unknown) {
    const parsed = setActiveCompanySchema.safeParse(input);
    if (!parsed.success)
      throw Object.assign(new Error(JSON.stringify(parsed.error.flatten())), {status: 400});
    const {userId, companyId} = parsed.data;

    const user = await userRepository.findById(userId);
    if (!user) throw Object.assign(new Error('User not found'), {status: 404});

    const company = await companyRepository.findById(companyId);
    if (!company) throw Object.assign(new Error('Company not found'), {status: 404});
    if (company.users.id !== userId)
      throw Object.assign(new Error('Company does not belong to user'), {status: 403});

    return userSettingsRepository.upsertActiveCompany(userId, companyId);
  },
};
