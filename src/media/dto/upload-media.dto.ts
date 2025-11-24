import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoProcesamiento } from '../entities/media.entity';

export class UploadMediaDto  {
  @IsNotEmpty()
  @IsString()
  idUsuario: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsNotEmpty()
  @IsEnum(['VIDEO', 'AUDIO'], { message: 'El tipo debe ser VIDEO o AUDIO' })
  tipo: 'VIDEO' | 'AUDIO';

  @IsOptional()
  @IsEnum(EstadoProcesamiento)
  estadoProcesamiento?: EstadoProcesamiento;
}
