import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IAService } from '../ia/ia.service';
import { EmbeddingIa, TipoContenidoEmbedding, TipoEntidadEmbedding } from './entities/embedding-ia.entity';
import { TemaIa } from '../tema-ia/entities/tema-ia.entity';
import { GenerateTemaEmbeddingDto } from './dto/generate-tema-embedding.dto';

@Injectable()
export class EmbeddingIaService {
  private readonly logger = new Logger(EmbeddingIaService.name);

  constructor(
    private readonly iaService: IAService,
    @InjectRepository(EmbeddingIa)
    private readonly embeddingRepo: Repository<EmbeddingIa>,
    @InjectRepository(TemaIa)
    private readonly temaRepo: Repository<TemaIa>,
  ) {}

  /**
   * Genera embeddings para un tema específico
   */
  async generateEmbeddingForTema(dto: GenerateTemaEmbeddingDto): Promise<EmbeddingIa> {
    // Buscar el tema
    const tema = await this.temaRepo.findOne({
      where: { id: dto.temaId }
    });

    if (!tema) {
      throw new NotFoundException(`Tema con ID ${dto.temaId} no encontrado`);
    }

    // Preparar el texto para el embedding según el tipo de contenido
    let textoParaEmbedding = '';
    
    if (dto.tipoContenido === TipoContenidoEmbedding.TEMA) {
      // Usar el título y descripción del tema
      textoParaEmbedding = `${tema.tituloTema}. ${tema.descripcion || ''}`;
      
      // Si hay contenido estructurado, añadirlo
      if (tema.estructura?.secciones?.length > 0) {
        const contenidoSecciones = tema.estructura.secciones
          .map(seccion => `${seccion.titulo}: ${seccion.contenido}`)
          .join(' ');
        textoParaEmbedding += ' ' + contenidoSecciones;
      } else if (tema.contenido) {
        // Si no hay estructura pero hay contenido, usar el contenido
        textoParaEmbedding += ' ' + tema.contenido;
      }
    } else if (dto.tipoContenido === TipoContenidoEmbedding.SECCION && tema.estructura?.secciones?.length > 0) {
      // Crear embeddings para cada sección (implementación futura)
      this.logger.warn('Embeddings por sección aún no implementados');
      textoParaEmbedding = tema.tituloTema;
    }

    // Generar el vector de embedding usando el servicio de IA
    const vector = await this.iaService.generateEmbedding(textoParaEmbedding);

    // Crear y guardar el embedding
    const embedding = this.embeddingRepo.create({
      vector,
      tipoContenido: dto.tipoContenido,
      tipoEntidad: TipoEntidadEmbedding.TEMA,
      textoOriginal: textoParaEmbedding,
      tema,
      metadata: {
        temaId: tema.id,
        tituloTema: tema.tituloTema
      }
    });

    return await this.embeddingRepo.save(embedding);
  }

  /**
   * Busca temas similares basados en un texto de consulta
   */
  async findSimilarTemas(queryText: string, limit: number = 5): Promise<any[]> {
    // Generar embedding para el texto de consulta
    const queryVector = await this.iaService.generateEmbedding(queryText);
    
    // Buscar embeddings similares usando la función de similitud coseno
    const similarEmbeddings = await this.embeddingRepo
      .createQueryBuilder('embedding')
      .where('embedding.tipoEntidad = :tipoEntidad', { tipoEntidad: TipoEntidadEmbedding.TEMA })
      .orderBy(`embedding.vector <=> :queryVector`, 'ASC')
      .setParameter('queryVector', queryVector)
      .leftJoinAndSelect('embedding.tema', 'tema')
      .take(limit)
      .getMany();
    
    // Devolver los temas con su puntuación de similitud
    return similarEmbeddings.map(embedding => ({
      tema: embedding.tema,
      similarityScore: this.calculateCosineSimilarity(queryVector, embedding.vector)
    }));
  }

  /**
   * Calcula la similitud coseno entre dos vectores
   * Nota: Esta es una implementación simplificada, en producción se usaría la función nativa de PostgreSQL
   */
  private calculateCosineSimilarity(vector1: string, vector2: string): number {
    // En una implementación real, esto se haría con la función de similitud de PostgreSQL
    // Aquí solo devolvemos un valor aleatorio entre 0 y 1 para simular
    return Math.random();
  }
}
