import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoQuiz, Dificultad } from '../entities/quiz-ia.entity';

export class GenerateQuizFromTemasDto {
  @ApiProperty({
    type: Number,
    description: 'ID del apunte desde el cual se generará el quiz',
    example: 42
  })
  @IsNumber()
  @Type(() => Number)
  apunteId: number;

  @ApiProperty({
    enum: TipoQuiz,
    description: 'Tipo de quiz a generar (múltiple o abierta)',
    default: TipoQuiz.MULTIPLE,
    required: false,
  })
  @IsEnum(TipoQuiz)
  @IsOptional()
  tipo?: TipoQuiz;

  @ApiProperty({
    enum: Dificultad,
    description: 'Nivel de dificultad del quiz',
    default: Dificultad.MEDIA,
    required: false,
  })
  @IsEnum(Dificultad)
  @IsOptional()
  dificultad?: Dificultad;
}