import { PartialType } from '@nestjs/swagger';
import { CreateRespuestaUsuarioDto } from './create-respuesta-usuario.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRespuestaUsuarioDto {
  @ApiPropertyOptional({
    description: 'Nueva respuesta del usuario',
    example: 'Esta es mi respuesta actualizada'
  })
  @IsOptional()
  @IsString({ message: 'La respuesta debe ser una cadena de texto' })
  respuestaUsuario?: string;
}