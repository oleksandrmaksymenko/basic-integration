import prisma from '@/db';

const select = {
  id: true,
  name: true,
  price: true,
  description: true,
  company: {select: {name: true}},
};

export const productRepository = {
  findAll: () => prisma.product.findMany({select}),
  findById: (id: string) => prisma.product.findUnique({where: {id}, select}),
  create: (data: {name: string; price: number; companyId: string; description?: string}) =>
    prisma.product.create({data, select}),
  update: (id: string, data: {name?: string; description?: string; price?: number}) =>
    prisma.product.update({where: {id}, data, select}),
  remove: (id: string) => prisma.product.delete({where: {id}}),
};
