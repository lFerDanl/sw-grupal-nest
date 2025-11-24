import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateSubtemaDto {
  @IsNotEmpty()
  @IsInt()
  parentTemaId: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  tituloTema: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  contenido?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  nivelProfundidad?: number;
}