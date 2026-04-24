import {z} from 'zod';
import bcrypt from 'bcryptjs';
import {employeeRepository} from '@/repositories';

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'USER']).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

export const employeeService = {
  getAll: () => employeeRepository.findAll(),

  async getById(id: string) {
    const employee = await employeeRepository.findById(id);
    if (!employee) throw Object.assign(new Error('Employee not found'), {status: 404});
    return employee;
  },

  async create(input: unknown) {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success)
      throw Object.assign(new Error(JSON.stringify(parsed.error.flatten())), {status: 400});
    const {password, ...rest} = parsed.data;
    return employeeRepository.create({...rest, password: await bcrypt.hash(password, 10)});
  },

  async update(id: string, input: unknown) {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success)
      throw Object.assign(new Error(JSON.stringify(parsed.error.flatten())), {status: 400});
    const data: Record<string, unknown> = {...parsed.data};
    if (parsed.data.password) data.password = await bcrypt.hash(parsed.data.password, 10);
    return employeeRepository.update(id, data);
  },

  remove: (id: string) => employeeRepository.remove(id),
};
