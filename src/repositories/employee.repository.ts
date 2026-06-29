import prisma from '@/db';
import {randomUUID} from 'node:crypto';

const select = {
  id: true,
  role: true,
  companies: {select: {name: true}},
  users: {select: {name: true, email: true}},
};

export const employeeRepository = {
  findAll: () => prisma.companyUser.findMany({select}),
  findById: (id: string) => prisma.companyUser.findUnique({where: {id}, select}),
  create: (data: {
    name: string;
    email: string;
    password: string;
    companyId: string;
    userId: string;
    role?: 'OWNER' | 'MANAGER' | 'EMPLOYEE';
  }) => prisma.companyUser.create({
    data: {
      id: randomUUID(),
      companyId: data.companyId,
      userId: data.userId,
      ...(data.role ? {role: data.role} : {}),
    },
    select,
  }),
  update: (id: string, data: Record<string, unknown>) =>
    prisma.companyUser.update({where: {id}, data: data as any, select}),
  remove: (id: string) => prisma.companyUser.delete({where: {id}}),
};