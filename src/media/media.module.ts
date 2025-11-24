import { Module, forwardRef } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './entities/media.entity';
import { BullModule } from '@nestjs/bullmq';
import { UsersModule } from 'src/users/users.module';
import { VideoProcessingProcessor } from './media.processor';
import { TranscripcionModule } from 'src/transcripcion/transcripcion.module';
import { MediaProducer } from './media.producer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Media]),
    BullModule.registerQueue({
      name: 'video-processing-queue',
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: 6379,
      },
      defaultJobOptions: {
        removeOnComplete: 100, 
        removeOnFail: 50,      
        attempts: 3,
        backoff: { 
          type: 'exponential', 
          delay: 2000 
        },
      },
    }),
    
    UsersModule,
    forwardRef(() => TranscripcionModule),
  ],
  controllers: [MediaController],
  providers: [
    MediaService, 
    MediaProducer, 
    VideoProcessingProcessor
  ],
  exports: [TypeOrmModule, MediaService,],
})
export class MediaModule {}