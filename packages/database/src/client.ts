import { PrismaClient } from './generated/prisma/index.js';

declare global {
  // Prevent multiple Prisma instances in development hot-reload
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

export const prisma: PrismaClient =
  process.env['NODE_ENV'] === 'production'
    ? createPrismaClient()
    : (global.__prisma ??= createPrismaClient());

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

export { PrismaClient };
export * from './generated/prisma/index.js';
