import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './lib/env';
import { rateLimit } from './middleware/rate-limit';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { procurementRouter } from './routes/procurement';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
}));
app.use(cors({ origin: env.webOrigin, credentials: true }));
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

app.use('/api/v1', healthRouter);
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50, keyPrefix: 'auth' }), authRouter);
app.use('/api/v1', rateLimit({ windowMs: 60 * 1000, max: 600, keyPrefix: 'api' }), procurementRouter);

app.use((_req: express.Request, res: express.Response) => {
  return res.status(404).json({ message: 'Not found' });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : 500;
  const message = err instanceof Error ? err.message : 'Unknown error';

  // Client errors carry safe, intentional messages; server errors must not leak internals.
  if (status >= 400 && status < 500) {
    return res.status(status).json({ message });
  }

  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error('[api] unhandled error', message);
  }
  return res.status(500).json({
    message: 'Unexpected server error',
    details: process.env.NODE_ENV === 'development' ? message : undefined,
  });
});
