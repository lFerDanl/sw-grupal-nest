import { ConfigService } from '@nestjs/config';

export const bullmqConfig = () => {
  const configService = new ConfigService();

  const host = configService.get<string>('REDIS_HOST') || 'localhost';
  const port = Number(configService.get<number>('REDIS_PORT')) || 6379;
  const passwordRaw = configService.get<string>('REDIS_PASSWORD');
  const password = passwordRaw && passwordRaw.length > 0 ? passwordRaw : undefined;

  return {
    connection: {
      host,
      port,
      password,
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  };
};
