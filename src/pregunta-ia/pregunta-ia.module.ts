import { Module } from '@nestjs/common';
import { PreguntaIaService } from './pregunta-ia.service';
import { PreguntaIa } from './entities/pregunta-ia.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizIaModule } from 'src/quiz-ia/quiz-ia.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PreguntaIa]),
    QuizIaModule,
  ],
  controllers: [],
  providers: [PreguntaIaService],
  exports: [TypeOrmModule],
})
export class PreguntaIaModule {}
