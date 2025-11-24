import { Module } from '@nestjs/common';
import { RespuestaController } from './respuesta-usuario.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreguntaIaModule } from 'src/pregunta-ia/pregunta-ia.module';
import { RespuestaUsuario } from './entities/respuesta-usuario.entity';
import { UsersModule } from 'src/users/users.module';
import { RespuestaUsuarioService } from './respuesta-usuario.service';
import { SesionEstudio } from 'src/sesion-estudio/entities/sesion-estudio.entity';
import { User } from 'src/users/entities/user.entity';
import { PreguntaIa } from 'src/pregunta-ia/entities/pregunta-ia.entity';
import { IAModule } from 'src/ia/ia.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RespuestaUsuario, PreguntaIa, SesionEstudio, User]),
    PreguntaIaModule,
    UsersModule,
    IAModule,
  ],
  controllers: [RespuestaController],
  providers: [RespuestaUsuarioService],
  exports: [TypeOrmModule],
})
export class RespuestaModule {}
