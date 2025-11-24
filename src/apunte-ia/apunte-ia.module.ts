import { forwardRef, Module } from '@nestjs/common';
import { ApunteIaService } from './apunte-ia.service';
import { ApunteIaController } from './apunte-ia.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TranscripcionModule } from 'src/transcripcion/transcripcion.module';
import { ApunteIa } from './entities/apunte-ia.entity';
import { BullModule } from '@nestjs/bullmq';
import { IAModule } from 'src/ia/ia.module';
import { TemaIaModule } from 'src/tema-ia/tema-ia.module';
import { ApuntesProcessor } from './apunte-ia.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApunteIa]),
    BullModule.registerQueue({
      name: 'apuntes-queue',
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
    forwardRef(() => TranscripcionModule),
    forwardRef(() => TemaIaModule),
    IAModule,
  ],
  controllers: [ApunteIaController],
  providers: [ApunteIaService,ApuntesProcessor,],
  exports: [TypeOrmModule, BullModule],
})
export class ApunteIaModule {}
