import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('sw-parcial')
    .setDescription('server backend para la aplicacion web de diagramas')
    .addBearerAuth()
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    explorer: true,
    swaggerOptions: {
      filter: true,
      showRequestDuration: true,
    },
  });

  // 🔹 Configurar Bull Board
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  try {
    // 🔹 Obtener la cola (nombre debe coincidir EXACTAMENTE)
    const videoQueue = app.get<Queue>('BullQueue_video-processing-queue');
    const transcripcionQueue = app.get<Queue>('BullQueue_transcription-queue');
    
    console.log('✅ Cola encontrada:', videoQueue.name);
    
    createBullBoard({
      queues: [new BullMQAdapter(videoQueue), new BullMQAdapter(transcripcionQueue)],
      serverAdapter,
    });

    // 🔹 Montar el dashboard
    app.use('/admin/queues', serverAdapter.getRouter());
  } catch (error) {
    console.error('❌ Error configurando Bull Board:', error.message);
  }

  app.enableCors({ origin: true, credentials: true });
  app.use(json({ limit: '5mb' }));

  await app.listen(process.env.PORT || 4000);
  console.log(`🚀 Servidor corriendo en http://localhost:${process.env.PORT || 4000}`);
  console.log(`📊 Bull Board disponible en http://localhost:${process.env.PORT || 4000}/admin/queues`);
}
bootstrap();