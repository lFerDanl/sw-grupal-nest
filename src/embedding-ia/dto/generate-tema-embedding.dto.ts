import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsEnum } from 'class-validator';
import { TipoContenidoEmbedding } from '../entities/embedding-ia.entity';

export class GenerateTemaEmbeddingDto {
  @ApiProperty({
    description: 'ID del tema para generar embeddings',
    example: 1
  })
  @IsNumber()
  temaId: number;

  @ApiProperty({
    description: 'Tipo de contenido para el embedding',
    enum: TipoContenidoEmbedding,
    default: TipoContenidoEmbedding.TEMA,
    example: TipoContenidoEmbedding.TEMA
  })
  @IsEnum(TipoContenidoEmbedding)
  @IsOptional()
  tipoContenido?: TipoContenidoEmbedding = TipoContenidoEmbedding.TEMA;
}