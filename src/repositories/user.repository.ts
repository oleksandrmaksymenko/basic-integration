import prisma from '@/db';

const select = {
  id: true,
  name: true,
  email: true,
  role: true,
  settings: {select: {activeCompanyId: true}},
  companies: true,
};

export const userRepository = {
  findAll: () => prisma.users.findMany({select}),
  findById: (id: string) => prisma.users.findUnique({where: {id}, select}),
  findByEmail: (email: string) => prisma.users.findUnique({where: {email}}),
  create: (data: {email: string; password: string; name?: string; role?: 'ADMIN' | 'USER'}) =>
    prisma.users.create({data, select}),
  update: (id: string, data: {name?: string; email?: string}) =>
    prisma.users.update({where: {id}, data, select}),
  remove: (id: string) => prisma.users.delete({where: {id}}),
};
