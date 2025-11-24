import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizIaService } from './quiz-ia.service';
import { QuizIaController } from './quiz-ia.controller';
import { QuizIa } from './entities/quiz-ia.entity';
import { PreguntaIa } from '../pregunta-ia/entities/pregunta-ia.entity';
import { TemaIa } from '../tema-ia/entities/tema-ia.entity';
import { ApunteIa } from '../apunte-ia/entities/apunte-ia.entity';
import { IAModule } from '../ia/ia.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuizIa, PreguntaIa, TemaIa, ApunteIa]),
    IAModule,
  ],
  controllers: [QuizIaController],
  providers: [QuizIaService],
  exports: [QuizIaService]
})
export class QuizIaModule {}
