import {z} from 'zod';
import bcrypt from 'bcryptjs';
import {userRepository} from '@/repositories';

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'USER']).optional(),
});

const updateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
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
};
