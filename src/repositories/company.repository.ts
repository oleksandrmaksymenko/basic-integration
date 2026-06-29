import prisma from '@/db';

const select = {
  id: true,
  name: true,
  users: {select: {id: true}},
};

export const companyRepository = {
  findAll: () => prisma.company.findMany({select}),
  findById: (id: string) => prisma.company.findUnique({where: {id}, select}),
  create: (data: {name: string; ownerId: string}) =>
    prisma.company.create({data, select}),
  update: (id: string, data: {name?: string; description?: string}) =>
    prisma.company.update({where: {id}, data, select}),
  remove: (id: string) => prisma.company.delete({where: {id}}),
};
