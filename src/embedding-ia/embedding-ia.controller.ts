import { Controller, Post, Body, Get, Query, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EmbeddingIaService } from './embedding-ia.service';
import { GenerateTemaEmbeddingDto } from './dto/generate-tema-embedding.dto';

@ApiTags('embedding-ia')
@Controller('embedding-ia')
export class EmbeddingIaController {
  constructor(private readonly embeddingIaService: EmbeddingIaService) {}

  @Post('tema')
  @ApiOperation({ summary: 'Genera embeddings para un tema específico' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Embedding generado exitosamente' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Tema no encontrado' 
  })
  generateTemaEmbedding(@Body() dto: GenerateTemaEmbeddingDto) {
    return this.embeddingIaService.generateEmbeddingForTema(dto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Busca temas similares basados en un texto de consulta' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Temas similares encontrados' 
  })
  findSimilarTemas(
    @Query('query') query: string,
    @Query('limit') limit: number = 5
  ) {
    return this.embeddingIaService.findSimilarTemas(query, limit);
  }
}
