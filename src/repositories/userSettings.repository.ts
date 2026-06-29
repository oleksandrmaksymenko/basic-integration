import prisma from '@/db';

const select = {
  id: true,
  activeCompanyId: true,
  userId: true,
};

export const userSettingsRepository = {
  findByUserId: (userId: string) => prisma.userSettings.findUnique({where: {userId}, select}),
  upsertActiveCompany: (userId: string, activeCompanyId: string) =>
    prisma.userSettings.upsert({
      where: {userId},
      create: {userId, activeCompanyId},
      update: {activeCompanyId},
      select,
    }),
};