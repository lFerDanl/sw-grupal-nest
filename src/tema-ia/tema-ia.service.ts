import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UpdateTemaIaDto } from './dto/update-tema-ia.dto';
import { TemaIa, SeccionTema, EstructuraTema } from './entities/tema-ia.entity';
import { ApunteIa } from '../apunte-ia/entities/apunte-ia.entity';
import { IAService } from '../ia/ia.service';
import { ChatMessage } from 'src/ia/interfaces/chat-message.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class TemaIaService {
  private readonly logger = new Logger(TemaIaService.name);

  constructor(
    private readonly iaService: IAService,
    @InjectRepository(TemaIa)
    private readonly temaRepo: Repository<TemaIa>,
    @InjectRepository(ApunteIa)
    private readonly apunteRepo: Repository<ApunteIa>,
  ) {}


    /**
   * Valida y normaliza el tipo de sección a un valor válido
   */
  private normalizeTipoSeccion(tipo: string): SeccionTema['tipoSeccion'] {
    const tiposValidos: SeccionTema['tipoSeccion'][] = [
      'introduccion',
      'concepto',
      'ejemplo',
      'ejercicio',
      'aplicacion',
      'conclusion',
      'referencia'
    ];
    
    const tipoLower = tipo.toLowerCase();
    if (tiposValidos.includes(tipoLower as any)) {
      return tipoLower as SeccionTema['tipoSeccion'];
    }
    
    return 'concepto'; // valor por defecto
  }

  /**
   * Genera y guarda temas estructurados a partir de un ApunteIa usando IA.
   * Cada tema incluye secciones organizadas en formato jsonb.
   */
  async generateTemaFromApunte(apunteIaId: number): Promise<TemaIa[]> {
    const apunte = await this.apunteRepo.findOne({ 
      where: { id: apunteIaId },
      relations: ['transcripcion']
    });
    if (!apunte) {
      throw new NotFoundException(`ApunteIa no encontrado (ID ${apunteIaId})`);
    }

    // Construir contexto completo
    const contenidoBase = apunte.contenido || '';
    const contextoTranscripcion = apunte.transcripcion?.texto ? 
      `\n\nTranscripción relacionada (contexto):\n${apunte.transcripcion.texto.substring(0, 2000)}` : '';

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Eres un profesor universitario experto que organiza contenido académico en temas estructurados y pedagógicos. ' +
          'Devuelve exclusivamente un JSON válido con temas que incluyan secciones organizadas. No incluyas texto extra.'
      },
      {
        role: 'user',
        content:
          `A partir del siguiente contenido de apuntes, genera entre 3 y 7 temas relevantes. ` +
          `Cada tema debe tener estructura interna con secciones educativas.\n\n` +
          `Formato estricto (solo JSON):\n` +
          `[{\n` +
          `  "titulo_tema": "Título conciso del tema",\n` +
          `  "descripcion": "Descripción breve del tema",\n` +
          `  "contenido": "Resumen general del tema",\n` +
          `  "nivel_profundidad": 1,\n` +
          `  "secciones": [\n` +
          `    {\n` +
          `      "tipoSeccion": "introduccion|concepto|ejemplo|ejercicio|aplicacion|conclusion",\n` +
          `      "titulo": "Título de la sección",\n` +
          `      "contenido": "Contenido detallado de la sección",\n` +
          `      "orden": 1\n` +
          `    }\n` +
          `  ]\n` +
          `}]\n\n` +
          `Tipos de sección disponibles:\n` +
          `- introduccion: Presentación del tema\n` +
          `- concepto: Definiciones y conceptos clave\n` +
          `- ejemplo: Ejemplos prácticos\n` +
          `- ejercicio: Ejercicios o problemas\n` +
          `- aplicacion: Aplicaciones prácticas\n` +
          `- conclusion: Síntesis y conclusiones\n\n` +
          `Contenido del apunte:\n${contenidoBase}${contextoTranscripcion}`
      }
    ];

    this.logger.log(`Generando temas estructurados para ApunteIa ${apunteIaId} usando ${this.iaService.getCurrentProvider()}`);
    const raw = await this.iaService.generateChatCompletion(messages, {
      temperature: 0.6,
      max_tokens: 6000, // Aumentado para asegurar que haya suficientes tokens para la generación completa
      stop: ['Usuario:', 'Human:', 'Assistant:']
    });

    const temasData = this.parseStructuredTemasResponse(raw);

    // Evitar duplicados por título en el mismo apunte
    const existentes = await this.temaRepo.find({ where: { apunte: { id: apunteIaId } } });
    const titulosExistentes = new Set(existentes.map(t => (t.tituloTema || '').trim().toLowerCase()));

    const nuevos: TemaIa[] = [];
    let orden = existentes.length;

    for (const temaData of temasData) {
      if (!temaData.titulo_tema || titulosExistentes.has(temaData.titulo_tema.trim().toLowerCase())) {
        continue;
      }

      // Crear estructura de secciones
      const secciones: SeccionTema[] = (temaData.secciones || []).map((seccion, index) => ({
        id: randomUUID(),
        tipoSeccion: this.normalizeTipoSeccion(seccion.tipoSeccion || 'concepto'),
        titulo: seccion.titulo || `Sección ${index + 1}`,
        contenido: seccion.contenido || '',
        orden: seccion.orden || index + 1,
        nivelProfundidad: 1,
        origen: 'ia' as const,
        createdAt: new Date().toISOString()
      }));

      const estructura: EstructuraTema = {
        secciones,
        version: 1,
        lastUpdated: new Date().toISOString()
      };

      const tema = this.temaRepo.create({
        tituloTema: temaData.titulo_tema,
        descripcion: temaData.descripcion || '',
        contenido: temaData.contenido || '',
        estructura,
        nivelProfundidad: Math.min(3, Math.max(1, temaData.nivel_profundidad ?? 1)),
        origen: 'ia',
        orden: orden++,
        apunte,
      });

      nuevos.push(tema);
      titulosExistentes.add(temaData.titulo_tema.trim().toLowerCase());
    }

    if (nuevos.length === 0) {
      this.logger.warn(`No se generaron temas nuevos para ApunteIa ${apunteIaId}`);
      return [];
    }

    const guardados = await this.temaRepo.save(nuevos);
    this.logger.log(`✅ ${guardados.length} temas estructurados guardados para ApunteIa ${apunteIaId}`);
    return guardados;
  }

  /**
   * Expande un tema existente agregando nuevas secciones o profundizando el contenido.
   * Incrementa el nivel de profundidad y genera contenido adicional.
   */
  async expandTema(temaId: number, tipoExpansion: 'profundizar' | 'ejemplos' | 'ejercicios' = 'profundizar'): Promise<TemaIa> {
    const tema = await this.temaRepo.findOne({ 
      where: { id: temaId },
      relations: ['apunte', 'apunte.transcripcion']
    });
    
    if (!tema) {
      throw new NotFoundException(`TemaIa no encontrado (ID ${temaId})`);
    }

    const contextoOriginal = tema.apunte?.contenido || '';
    const estructuraActual = tema.estructura || { secciones: [], version: 1, lastUpdated: new Date().toISOString() };

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Eres un profesor universitario experto que profundiza contenido académico. ' +
          'Genera nuevas secciones para expandir un tema existente. Devuelve solo JSON válido.'
      },
      {
        role: 'user',
        content:
          `Expande el siguiente tema agregando nuevas secciones de tipo "${tipoExpansion}".\n\n` +
          `Tema actual:\n` +
          `- Título: ${tema.tituloTema}\n` +
          `- Descripción: ${tema.descripcion}\n` +
          `- Contenido: ${tema.contenido}\n` +
          `- Nivel actual: ${tema.nivelProfundidad}\n` +
          `- Secciones existentes: ${estructuraActual.secciones.length}\n\n` +
          `Contexto original del apunte:\n${contextoOriginal.substring(0, 1500)}\n\n` +
          `Genera 2-4 nuevas secciones según el tipo de expansión:\n` +
          `- profundizar: Conceptos más avanzados, detalles técnicos\n` +
          `- ejemplos: Ejemplos prácticos adicionales\n` +
          `- ejercicios: Ejercicios y problemas para practicar\n\n` +
          `Formato JSON:\n` +
          `{\n` +
          `  "nuevas_secciones": [\n` +
          `    {\n` +
          `      "tipoSeccion": "concepto|ejemplo|ejercicio|aplicacion",\n` +
          `      "titulo": "Título de la nueva sección",\n` +
          `      "contenido": "Contenido detallado de la sección"\n` +
          `    }\n` +
          `  ],\n` +
          `  "contenido_actualizado": "Resumen actualizado del tema expandido"\n` +
          `}`
      }
    ];

    this.logger.log(`Expandiendo tema ${temaId} con tipo: ${tipoExpansion}`);
    const raw = await this.iaService.generateChatCompletion(messages, {
      temperature: 0.7,
      max_tokens: 1500,
      stop: ['Usuario:', 'Human:', 'Assistant:']
    });

    const expansionData = this.parseExpansionResponse(raw);
    
    // Agregar nuevas secciones a la estructura existente
    const nuevasSecciones: SeccionTema[] = (expansionData.nuevas_secciones || []).map((seccion, index) => ({
      id: randomUUID(),
      tipoSeccion: this.normalizeTipoSeccion(seccion.tipoSeccion || 'concepto'),
      titulo: seccion.titulo || `Nueva sección ${index + 1}`,
      contenido: seccion.contenido || '',
      orden: estructuraActual.secciones.length + index + 1,
      nivelProfundidad: tema.nivelProfundidad + 1,
      origen: 'ia' as const,
      createdAt: new Date().toISOString()
    }));

    const estructuraActualizada: EstructuraTema = {
      secciones: [...estructuraActual.secciones, ...nuevasSecciones],
      version: estructuraActual.version + 1,
      lastUpdated: new Date().toISOString()
    };

    // Actualizar el tema
    tema.estructura = estructuraActualizada;
    tema.contenido = expansionData.contenido_actualizado || tema.contenido;
    tema.nivelProfundidad = Math.min(5, tema.nivelProfundidad + 1);
    tema.origen = tema.origen === 'usuario' ? 'mixto' : tema.origen;

    const temaActualizado = await this.temaRepo.save(tema);
    this.logger.log(`✅ Tema ${temaId} expandido con ${nuevasSecciones.length} nuevas secciones`);
    
    return temaActualizado;
  }

  /** Lista los temas asociados a un ApunteIa con estructura jerárquica */
  async listTemasByApunteId(apunteIaId: number): Promise<TemaIa[]> {
    return await this.temaRepo.find({ 
      where: { apunte: { id: apunteIaId }, parentTema: IsNull() }, // Solo temas raíz
      relations: ['subtemas'],
      order: { orden: 'ASC', createdAt: 'ASC' }
    });
  }

  /** Obtiene un tema por ID con todas sus relaciones */
  async findOne(id: number): Promise<TemaIa | null> {
    return await this.temaRepo.findOne({ 
      where: { id },
      relations: ['subtemas', 'parentTema', 'apunte']
    });
  }

  /**
   * Agrega una sección creada por el usuario a un tema existente.
   */
  async addUserSection(temaId: number, seccionData: {
    tipoSeccion: SeccionTema['tipoSeccion'];
    titulo: string;
    contenido: string;
  }): Promise<TemaIa> {
    const tema = await this.findOne(temaId);
    if (!tema) throw new NotFoundException(`TemaIa no encontrado (ID ${temaId})`);

    const estructuraActual = tema.estructura || { secciones: [], version: 1, lastUpdated: new Date().toISOString() };
    
    const nuevaSeccion: SeccionTema = {
      id: randomUUID(),
      tipoSeccion: seccionData.tipoSeccion,
      titulo: seccionData.titulo,
      contenido: seccionData.contenido,
      orden: estructuraActual.secciones.length + 1,
      nivelProfundidad: tema.nivelProfundidad,
      origen: 'usuario',
      createdAt: new Date().toISOString()
    };

    const estructuraActualizada: EstructuraTema = {
      secciones: [...estructuraActual.secciones, nuevaSeccion],
      version: estructuraActual.version + 1,
      lastUpdated: new Date().toISOString()
    };

    tema.estructura = estructuraActualizada;
    tema.origen = tema.origen === 'ia' ? 'mixto' : tema.origen;

    return await this.temaRepo.save(tema);
  }

  /** Actualiza un tema (título, descripción, contenido, nivel) */
  async update(id: number, dto: UpdateTemaIaDto): Promise<TemaIa> {
    const tema = await this.temaRepo.findOne({ where: { id } });
    if (!tema) throw new NotFoundException(`TemaIa no encontrado (ID ${id})`);

    if (dto.tituloTema !== undefined) tema.tituloTema = dto.tituloTema;
    if (dto.descripcion !== undefined) tema.descripcion = dto.descripcion;
    if (dto.nivelProfundidad !== undefined) tema.nivelProfundidad = Math.min(5, Math.max(1, dto.nivelProfundidad));

    return await this.temaRepo.save(tema);
  }

  /** Eliminación suave del tema */
  async remove(id: number): Promise<{ message: string }> {
    const result = await this.temaRepo.softDelete(id);
    if (result.affected && result.affected > 0) {
      return { message: `TemaIa ${id} eliminado` };
    }
    throw new NotFoundException(`TemaIa no encontrado (ID ${id})`);
  }

  /**
   * Parsea la respuesta de IA para temas estructurados con secciones.
   */
  private parseStructuredTemasResponse(raw: string): Array<{
    titulo_tema: string;
    descripcion?: string;
    contenido?: string;
    nivel_profundidad?: number;
    secciones?: Array<{
      tipoSeccion: string;
      titulo: string;
      contenido: string;
      orden?: number;
    }>;
  }> {
    try {
      console.log(raw)
      const cleaned = raw.trim();
      const jsonStr = this.extractJson(cleaned);
      const parsed = JSON.parse(jsonStr);
      console.log(parsed)
      if (!Array.isArray(parsed)) throw new Error('La respuesta no es un arreglo JSON');

      return parsed.map((t: any) => ({
        titulo_tema: t.titulo_tema || t.tituloTema || '',
        descripcion: t.descripcion || '',
        contenido: t.contenido || '',
        nivel_profundidad: t.nivel_profundidad ?? t.nivelProfundidad ?? 1,
        secciones: Array.isArray(t.secciones) ? t.secciones : []
      }));
    } catch (error) {
      this.logger.error(`No se pudo parsear la respuesta de temas estructurados: ${error.message}`);
      return [];
    }
  }

  /**
   * Parsea la respuesta de IA para expansión de temas.
   */
  private parseExpansionResponse(raw: string): {
    nuevas_secciones?: Array<{
      tipoSeccion: string;
      titulo: string;
      contenido: string;
    }>;
    contenido_actualizado?: string;
  } {
    try {
      const cleaned = raw.trim();
      const jsonStr = this.extractJson(cleaned);
      const parsed = JSON.parse(jsonStr);

      if (Array.isArray(parsed)) {
        return { nuevas_secciones: parsed, contenido_actualizado: '' };
      }

      const nuevas = parsed.nuevas_secciones ?? parsed.nuevasSecciones ?? parsed.secciones ?? parsed.sections ?? [];
      const contenidoAct = parsed.contenido_actualizado ?? parsed.contenidoActualizado ?? parsed.contenido ?? '';

      return {
        nuevas_secciones: Array.isArray(nuevas) ? nuevas : [],
        contenido_actualizado: typeof contenidoAct === 'string' ? contenidoAct : ''
      };
    } catch (error) {
      this.logger.error(`No se pudo parsear la respuesta de expansión: ${error.message}`);
      return { nuevas_secciones: [] };
    }
  }

  private extractJson(text: string): string {
    let t = text.trim();
    
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    t = t.trim();
    
    const firstBracket = t.indexOf('[');
    const lastBracket = t.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      return t.substring(firstBracket, lastBracket + 1);
    }
    
    const firstBrace = t.indexOf('{');
    const lastBrace = t.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return t.substring(firstBrace, lastBrace + 1);
    }
    
    return t;
  }
}
