import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TipoApunte } from '../entities/apunte-ia.entity';

export class CreateApunteIaDto {
  @IsNotEmpty()
  @IsInt()
  idTranscripcion: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsNotEmpty()
  @IsString()
  contenidoResumen: string;

  @IsOptional()
  @IsEnum(TipoApunte)
  tipo?: TipoApunte;
}