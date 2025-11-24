import { IsEnum, IsOptional } from 'class-validator';

export class ExpandTemaDto {
  @IsOptional()
  @IsEnum(['profundizar', 'ejemplos', 'ejercicios'])
  tipoExpansion?: 'profundizar' | 'ejemplos' | 'ejercicios' = 'profundizar';
}