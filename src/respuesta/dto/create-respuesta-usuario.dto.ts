import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRespuestaUsuarioDto {
  @ApiProperty({
    description: 'ID de la pregunta a la que se está respondiendo',
    example: 1
  })
  @IsNotEmpty({ message: 'El ID de la pregunta es obligatorio' })
  @IsNumber({}, { message: 'El ID de la pregunta debe ser un número' })
  idPregunta: number;

  @ApiProperty({
    description: 'ID del usuario que está respondiendo',
    example: 1
  })
  @IsNotEmpty({ message: 'El ID del usuario es obligatorio' })
  @IsNumber({}, { message: 'El ID del usuario debe ser un número' })
  idUsuario: number;

  @ApiProperty({
    description: 'ID de la sesión de estudio actual',
    example: 1
  })
  @IsNotEmpty({ message: 'El ID de la sesión es obligatorio' })
  @IsNumber({}, { message: 'El ID de la sesión debe ser un número' })
  idSesion: number;

  @ApiProperty({
    description: 'Respuesta proporcionada por el usuario (texto o índice de opción)',
    example: '2'
  })
  @IsNotEmpty({ message: 'La respuesta del usuario es obligatoria' })
  @IsString({ message: 'La respuesta debe ser una cadena de texto' })
  respuestaUsuario: string;
}