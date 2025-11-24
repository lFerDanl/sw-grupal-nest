import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule } from './auth/auth.module';
import { MediaModule } from './media/media.module';
import { TranscripcionModule } from './transcripcion/transcripcion.module';
import { ApunteIaModule } from './apunte-ia/apunte-ia.module';
import { TemaIaModule } from './tema-ia/tema-ia.module';
import { QuizIaModule } from './quiz-ia/quiz-ia.module';
import { PreguntaIaModule } from './pregunta-ia/pregunta-ia.module';
import { RespuestaModule } from './respuesta/respuesta-usuario.module';
import { SesionEstudioModule } from './sesion-estudio/sesion-estudio.module';
import { EmbeddingIaModule } from './embedding-ia/embedding-ia.module';
import { IAModule } from './ia/ia.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        //----------
        ssl: process.env.POSTGRES_SSL === "true",
        extra: {
          ssl:
            {
              rejectUnauthorized: false,
            },
        },
      }),
    }),
    AuthModule,
    MediaModule,
    TranscripcionModule,
    ApunteIaModule,
    TemaIaModule,
    QuizIaModule,
    PreguntaIaModule,
    RespuestaModule,
    SesionEstudioModule,
    EmbeddingIaModule,
    IAModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
