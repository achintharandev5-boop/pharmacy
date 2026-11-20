import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const options =
    process.env.DEPLOYMENT_PROFILE === 'synthetic-staging'
      ? { logger: new ConsoleLogger({ json: true }) }
      : {};
  const app = await NestFactory.create(AppModule, options);
  const config = app.get(ConfigService);

  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  // Staging is server-to-server only. Do not let CORS answer an unauthenticated
  // OPTIONS request before the mandatory gateway middleware runs.
  if (config.get<string>('DEPLOYMENT_PROFILE') !== 'synthetic-staging')
    app.enableCors({
      origin: config
        .getOrThrow<string>('FRONTEND_URL')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    });

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API listening on port ${port}`);
}
bootstrap().catch(() => {
  // Startup errors can contain provider configuration; do not dump their values.
  new Logger('Bootstrap').error(
    'API startup failed. Check configuration and service availability.',
  );
  process.exitCode = 1;
});
