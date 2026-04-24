import prisma from '@/db';

const select = {
  id: true,
  status: true,
  total: true,
  createdAt: true,
  company: {select: {name: true}},
};

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export const orderRepository = {
  findAll: () => prisma.order.findMany({select}),
  findById: (id: string) => prisma.order.findUnique({where: {id}, select}),
  findByCompany: (companyId: string) => prisma.order.findMany({where: {companyId}, select}),
  create: (data: {total: number; companyId: string; status?: OrderStatus}) =>
    prisma.order.create({data, select}),
  update: (id: string, data: {status?: OrderStatus; total?: number}) =>
    prisma.order.update({where: {id}, data, select}),
  remove: (id: string) => prisma.order.delete({where: {id}}),
};
