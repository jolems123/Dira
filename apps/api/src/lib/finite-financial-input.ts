import { z } from 'zod';

// Zod's positive/nonnegative checks alone may accept positive Infinity.
// Prevent nonfinite values reaching financial arithmetic or Prisma Decimal.
export const nonnegativeMoney = z.number().finite().nonnegative();
export const positiveMoney = z.number().finite().positive();
