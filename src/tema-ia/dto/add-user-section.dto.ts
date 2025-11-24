import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { SeccionTema } from '../entities/tema-ia.entity';

export class AddUserSectionDto {
  @IsNotEmpty()
  @IsEnum(['introduccion', 'concepto', 'ejemplo', 'ejercicio', 'aplicacion', 'conclusion', 'referencia'])
  tipoSeccion: SeccionTema['tipoSeccion'];

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  titulo: string;

  @IsNotEmpty()
  @IsString()
  contenido: string;
}