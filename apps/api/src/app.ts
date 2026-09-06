import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './lib/env';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { procurementRouter } from './routes/procurement';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.webOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1', procurementRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unknown error';
  return res.status(500).json({
    message: 'Unexpected server error',
    details: process.env.NODE_ENV === 'development' ? message : undefined,
  });
});
