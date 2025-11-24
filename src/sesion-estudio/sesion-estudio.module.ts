import { Module, forwardRef } from '@nestjs/common';
import { SesionEstudioService } from './sesion-estudio.service';
import { SesionEstudioController } from './sesion-estudio.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SesionEstudio } from './entities/sesion-estudio.entity';
import { UsersModule } from 'src/users/users.module';
import { User } from 'src/users/entities/user.entity';
import { QuizIa } from 'src/quiz-ia/entities/quiz-ia.entity';
import { EmbeddingIaModule } from 'src/embedding-ia/embedding-ia.module';
import { TemaIa } from 'src/tema-ia/entities/tema-ia.entity';
import { RespuestaUsuario } from 'src/respuesta/entities/respuesta-usuario.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SesionEstudio, User, QuizIa, TemaIa, RespuestaUsuario]),
    forwardRef(() => (UsersModule)),
    EmbeddingIaModule,
  ],
  controllers: [SesionEstudioController],
  providers: [SesionEstudioService],
  exports: [TypeOrmModule],
})
export class SesionEstudioModule {}
