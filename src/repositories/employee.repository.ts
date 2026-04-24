import prisma from '@/db';

const select = {
  id: true,
  name: true,
  email: true,
  company: {select: {name: true}},
  user: {select: {name: true}},
};

export const employeeRepository = {
  findAll: () => prisma.employee.findMany({select}),
  findById: (id: string) => prisma.employee.findUnique({where: {id}, select}),
  create: (data: {
    name: string;
    email: string;
    password: string;
    companyId: string;
    userId: string;
    role?: 'ADMIN' | 'USER';
  }) => prisma.employee.create({data, select}),
  update: (id: string, data: Record<string, unknown>) =>
    prisma.employee.update({where: {id}, data, select}),
  remove: (id: string) => prisma.employee.delete({where: {id}}),
};
