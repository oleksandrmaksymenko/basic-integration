import 'dotenv/config';
import {defineConfig, env} from 'prisma/config';
import path from "node:path";

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.POSTGRES_URL_NON_POOLING ?? env('POSTGRES_URL'),
  },
});