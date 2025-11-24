import { IsOptional, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSesionEstudioDto {
  @ApiPropertyOptional({
    description: 'Duración total de la sesión en segundos',
    example: 3600
  })
  @IsOptional()
  @IsNumber({}, { message: 'La duración debe ser un número' })
  @Min(0, { message: 'La duración no puede ser negativa' })
  duracionTotal?: number;
}