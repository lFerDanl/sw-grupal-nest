import { Module, forwardRef } from '@nestjs/common';
import { TranscripcionService } from './transcripcion.service';
import { TranscripcionController } from './transcripcion.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transcripcion } from './entities/transcripcion.entity';
import { MediaModule } from 'src/media/media.module';
import { BullModule } from '@nestjs/bullmq';
import { TranscriptionProcessor } from './transcripcion.process';
import { ApunteIaModule } from 'src/apunte-ia/apunte-ia.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transcripcion]),
    forwardRef(() => (MediaModule)),
    BullModule.registerQueue({
      name: 'transcription-queue',
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: 6379,
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    }),
    forwardRef(() => (ApunteIaModule)),
  ],
  controllers: [TranscripcionController],
  providers: [TranscripcionService, TranscriptionProcessor],
  exports: [TypeOrmModule,BullModule,],
})
export class TranscripcionModule {}
