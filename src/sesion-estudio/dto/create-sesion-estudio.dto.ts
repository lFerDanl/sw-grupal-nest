import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSesionEstudioDto {
  @ApiProperty({
    description: 'ID del usuario que inicia la sesión de estudio',
    example: 1
  })
  @IsNotEmpty({ message: 'El ID del usuario es obligatorio' })
  @IsNumber({}, { message: 'El ID del usuario debe ser un número' })
  usuarioId: number;

  @ApiPropertyOptional({
    description: 'ID del quiz asociado a la sesión (opcional)',
    example: 1
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID del quiz debe ser un número' })
  quizId?: number;
}