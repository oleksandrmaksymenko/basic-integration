import {PrismaClient} from '@prisma/client';

const prismaClientSingleton = () => new PrismaClient();
type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prismaGlobal: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prismaGlobal ?? prismaClientSingleton();
export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaGlobal = prisma;
}
