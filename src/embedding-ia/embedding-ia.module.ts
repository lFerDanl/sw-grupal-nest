import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmbeddingIaService } from './embedding-ia.service';
import { EmbeddingIaController } from './embedding-ia.controller';
import { EmbeddingIa } from './entities/embedding-ia.entity';
import { TemaIa } from '../tema-ia/entities/tema-ia.entity';
import { IAModule } from '../ia/ia.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmbeddingIa, TemaIa]),
    IAModule
  ],
  controllers: [EmbeddingIaController],
  providers: [EmbeddingIaService],
  exports: [EmbeddingIaService]
})
export class EmbeddingIaModule {}
