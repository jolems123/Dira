import { z } from 'zod';

// Bound expensive password hashing/comparison work for public auth endpoints.
// Do not trim or normalize passwords: existing password bytes must remain intact.
export const passwordInput = z.string().min(8).max(128);
