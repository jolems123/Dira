import { app } from './app';
import { env } from './lib/env';
import { logger } from './lib/logger';

app.listen(env.port, () => {
  logger.info(`Dira API running on http://localhost:${env.port}`);
});
