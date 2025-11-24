import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateTemaIaDto {
  @IsNotEmpty()
  @IsInt()
  idApunte: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  tituloTema: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  nivelProfundidad?: number;
}