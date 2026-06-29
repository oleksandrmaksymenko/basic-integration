process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {Pool} from 'pg';

const createPrismaClient = () => {
  const pool = new Pool({connectionString: process.env.POSTGRES_URL!, ssl: {rejectUnauthorized: false}});
  const adapter = new PrismaPg(pool);
  return new PrismaClient({adapter} as ConstructorParameters<
    typeof PrismaClient
  >[0]);
};

type PrismaClientSingleton = ReturnType<typeof createPrismaClient>;

declare global {

  var __prismaGlobal: PrismaClientSingleton | undefined;
}

const prisma = globalThis.__prismaGlobal ?? createPrismaClient();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prismaGlobal = prisma;
}
