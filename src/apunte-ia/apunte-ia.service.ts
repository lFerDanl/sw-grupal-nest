// src/apunte-ia/apunte-ia.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IAService } from '../ia/ia.service';
import { ChatMessage } from '../ia/interfaces/chat-message.interface';
import { ApunteIa, TipoApunte, EstadoProcesamiento } from './entities/apunte-ia.entity';
import { Transcripcion } from '../transcripcion/entities/transcripcion.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { UpdateApunteIaDto } from './dto/update-apunte-ia.dto';

export interface ApunteGenerado {
  tipo: TipoApunte;
  contenido: string;
}

@Injectable()
export class ApunteIaService {
  private readonly logger = new Logger(ApunteIaService.name);

  constructor(
    private readonly iaService: IAService,
    @InjectRepository(ApunteIa)
    private readonly apunteRepo: Repository<ApunteIa>,
    @InjectRepository(Transcripcion)
    private readonly transcripcionRepo: Repository<Transcripcion>,
    @InjectQueue('apuntes-queue') 
    private readonly queue: Queue,
  ) {}

  generateApuntesFromTranscription(transcripcionId: number, userId: number) {
    const id = randomUUID();
    return this.queue.add(
      'generate-apuntes', 
      { transcripcionId, userId }, 
      { 
        jobId: id,
      }
    );
  }

  /**
   * 🎯 OPTIMIZADO V2: Genera y GUARDA apuntes de forma incremental
   * Cada apunte se guarda inmediatamente después de generarse
   */
  async generateApuntesIncremental(transcripcionId: number, userId: number): Promise<ApunteIa[]> {
    try {
      this.logger.log(`Iniciando generación incremental para transcripción ${transcripcionId}`);

      // Obtener la transcripción
      const transcripcion = await this.transcripcionRepo.findOne({
        where: { id: transcripcionId }
      });

      if (!transcripcion) {
        throw new Error(`Transcripción ${transcripcionId} no encontrada`);
      }

      // Verificar servicio disponible
      await this.verificarYSeleccionarProveedor();

      const apuntesGuardados: ApunteIa[] = [];

      // 1️⃣ RESUMEN
      const resumenGuardado = await this.generarYGuardarApunte(
        transcripcion,
        TipoApunte.RESUMEN,
        'Resumen de la clase',
        userId
      );
      if (resumenGuardado) {
        apuntesGuardados.push(resumenGuardado);
      }

      // 2️⃣ EXPLICACIÓN
      const explicacionGuardada = await this.generarYGuardarApunte(
        transcripcion,
        TipoApunte.EXPLICACION,
        'Explicación detallada',
        userId
      );
      if (explicacionGuardada) {
        apuntesGuardados.push(explicacionGuardada);
      }

      // 3️⃣ FLASHCARDS
      const flashcardsGuardadas = await this.generarYGuardarFlashcards(transcripcion,userId);
      apuntesGuardados.push(...flashcardsGuardadas);

      this.logger.log(
        `✅ Proceso completado. Total apuntes guardados: ${apuntesGuardados.length} ` +
        `con ${this.iaService.getCurrentProvider()}`
      );

      return apuntesGuardados;
    } catch (error) {
      this.logger.error('❌ Error en generación incremental:', error.message);
      throw error;
    }
  }

  /**
   * 💾 Genera y guarda un apunte individual
   * Si ya existe, lo salta. Si falla, continúa con el siguiente.
   */
  private async generarYGuardarApunte(
    transcripcion: Transcripcion,
    tipo: TipoApunte,
    titulo: string,
    userId: number
  ): Promise<ApunteIa | null> {
    try {
      // Verificar si ya existe
      const existe = await this.apunteRepo.findOne({
        where: {
          transcripcion: { id: transcripcion.id },
          tipo,
          estadoIA: EstadoProcesamiento.COMPLETADO
        }
      });

      if (existe) {
        this.logger.log(`⏭️  ${tipo} ya existe (ID: ${existe.id}), saltando...`);
        return existe;
      }

      this.logger.log(`Generando ${tipo}...`);

      // Generar contenido
      let contenido: string;
      switch (tipo) {
        case TipoApunte.RESUMEN:
          contenido = await this.generarResumen(transcripcion.texto);
          break;
        case TipoApunte.EXPLICACION:
          contenido = await this.generarExplicacion(transcripcion.texto);
          break;
        case TipoApunte.MAPA:
          contenido = await this.generarMapaConceptual(transcripcion.texto);
          break;
        default:
          throw new Error(`Tipo no soportado: ${tipo}`);
      }

      // Guardar inmediatamente
      const apunte = this.apunteRepo.create({
        tipo,
        contenido,
        titulo,
        estadoIA: EstadoProcesamiento.COMPLETADO,
        transcripcion,
        user: { id: userId }
      });

      const guardado = await this.apunteRepo.save(apunte);
      this.logger.log(`✅ ${tipo} guardado (ID: ${guardado.id})`);

      return guardado;
    } catch (error) {
      this.logger.error(`❌ Error generando ${tipo}: ${error.message}`);
      
      // Guardar apunte con estado ERROR
      try {
        const apunteError = this.apunteRepo.create({
          tipo,
          contenido: `Error: ${error.message}`,
          titulo: `${titulo} (Error)`,
          estadoIA: EstadoProcesamiento.ERROR,
          transcripcion
        });
        await this.apunteRepo.save(apunteError);
      } catch (saveError) {
        this.logger.error(`No se pudo guardar apunte de error: ${saveError.message}`);
      }

      return null;
    }
  }

  /**
   * 💾 Genera y guarda flashcards individuales
   */
  private async generarYGuardarFlashcards(
    transcripcion: Transcripcion,
    userId: number
  ): Promise<ApunteIa[]> {
    try {
      // Verificar flashcards existentes
      const existentes = await this.apunteRepo.find({
        where: {
          transcripcion: { id: transcripcion.id },
          tipo: TipoApunte.FLASHCARD,
          estadoIA: EstadoProcesamiento.COMPLETADO
        }
      });

      if (existentes.length > 0) {
        this.logger.log(`⏭️  ${existentes.length} flashcards ya existen, saltando...`);
        return existentes;
      }

      this.logger.log('Generando flashcards...');

      // Generar flashcards
      const flashcardsTexto = await this.solicitarFlashcards(transcripcion.texto);
      const flashcardsParsed = this.parsearFlashcards(flashcardsTexto);

      if (!flashcardsParsed.length) {
        this.logger.warn('⚠️ Ninguna flashcard válida encontrada. IA pudo no seguir formato.');
      }

      // Guardar cada flashcard
      const guardadas: ApunteIa[] = [];
      for (let i = 0; i < flashcardsParsed.length; i++) {
        const { contenido } = flashcardsParsed[i];
        
        const apunte = this.apunteRepo.create({
          tipo: TipoApunte.FLASHCARD,
          contenido,
          titulo: `Tarjeta de estudio ${i + 1}`,
          estadoIA: EstadoProcesamiento.COMPLETADO,
          transcripcion,
          user: { id: userId }
        });

        const guardada = await this.apunteRepo.save(apunte);
        guardadas.push(guardada);
        this.logger.log(`✅ Flashcard ${i + 1} guardada (ID: ${guardada.id})`);
      }

      this.logger.log(`✅ ${guardadas.length} flashcards guardadas exitosamente`);
      return guardadas;
    } catch (error) {
      this.logger.error(`❌ Error generando flashcards: ${error.message}`);
      return [];
    }
  }

  /**
   * 🔍 Verifica y selecciona el mejor proveedor disponible
   */
  private async verificarYSeleccionarProveedor(): Promise<void> {
    const isHealthy = await this.iaService.healthCheck();
    
    if (!isHealthy) {
      this.logger.warn('Proveedor principal no disponible, buscando alternativas...');
      
      const healthStatus = await this.iaService.healthCheckAll();
      this.logger.log(`Estado de proveedores: ${JSON.stringify(healthStatus)}`);
      
      const availableProvider = Object.entries(healthStatus).find(([_, healthy]) => healthy);
      
      if (!availableProvider) {
        throw new Error('❌ Ningún servicio de IA está disponible');
      }
      
      const [providerName] = availableProvider;
      this.logger.log(`✅ Usando proveedor alternativo: ${providerName}`);
      this.iaService.setProvider(providerName as any);
    } else {
      this.logger.log(`✅ Usando proveedor: ${this.iaService.getCurrentProvider()}`);
    }
  }

  /**
   * Genera un resumen conciso
   */
  private async generarResumen(transcripcion: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Eres un profesor universitario experto en crear resúmenes educativos claros y concisos. 
IMPORTANTE: SIEMPRE respondes en español de manera natural y académica.`
      },
      {
        role: 'user',
        content: `Por favor, genera un resumen breve y claro del siguiente contenido de clase. 

El resumen debe:
- Capturar los puntos principales y conceptos clave
- Estar organizado en 3-5 párrafos
- Ser claro y fácil de entender
- Mantener el rigor académico

Contenido de la clase:
${transcripcion}

Genera el resumen en español:`
      }
    ];

    return await this.iaService.generateChatCompletion(messages, {
      temperature: 0.5,
      max_tokens: 4000, // Aumentado para asegurar suficientes tokens
      stop: ['\n\n\n', 'Usuario:', 'Pregunta:', 'Human:', 'Assistant:']
    });
  }

  /**
   * Genera una explicación detallada
   */
  private async generarExplicacion(transcripcion: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Eres un profesor universitario que explica conceptos de manera clara, didáctica y con ejemplos prácticos. 
IMPORTANTE: SIEMPRE respondes en español de manera educativa y comprensible.`
      },
      {
        role: 'user',
        content: `Por favor, genera una explicación detallada y didáctica del siguiente contenido de clase.

La explicación debe incluir:
1. Conceptos principales explicados de forma clara
2. Ejemplos prácticos que ayuden a entender mejor
3. Conexiones entre ideas y conceptos relacionados
4. Aplicaciones prácticas o casos de uso (si es relevante)
5. Estructura organizada y coherente

Contenido de la clase:
${transcripcion}

Genera la explicación detallada en español:`
      }
    ];

    return await this.iaService.generateChatCompletion(messages, {
      temperature: 0.7,
      max_tokens: 4000, // Aumentado para asegurar suficientes tokens
      stop: ['\n\n\n\n', 'Usuario:', 'Human:', 'Assistant:']
    });
  }

  /**
   * Solicita flashcards a la IA
   */
  private async solicitarFlashcards(transcripcion: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Eres un profesor experto en crear flashcards educativas efectivas. 
IMPORTANTE: SIEMPRE respondes en español y sigues el formato exacto solicitado.`
      },
      {
        role: 'user',
        content: `A partir del siguiente contenido de clase, genera exactamente 5 flashcards en el formato especificado.

FORMATO REQUERIDO:

PREGUNTA: [pregunta concisa y clara]
RESPUESTA: [respuesta clara y breve]

---

PREGUNTA: [segunda pregunta]
RESPUESTA: [segunda respuesta]

---

(y así sucesivamente para las 5 flashcards)

Instrucciones:
- Las preguntas deben cubrir los conceptos más importantes
- Las preguntas deben ser claras y directas
- Las respuestas deben ser concisas pero completas
- Usar el separador "---" entre cada flashcard
- Todo en español

Contenido de la clase:
${transcripcion}

Genera las 5 flashcards siguiendo el formato exacto:`
      }
    ];

    return await this.iaService.generateChatCompletion(messages, {
      temperature: 0.6,
      max_tokens: 1000,
      stop: ['Usuario:', 'Human:', 'Assistant:', '\n\n\n\n']
    });
  }

  /**
   * Parsea flashcards del texto generado
   */
  private parsearFlashcards(texto: string): ApunteGenerado[] {
    const flashcards: ApunteGenerado[] = [];
    
    this.logger.debug('Parseando flashcards del texto generado');
    
    const tarjetas = texto.split(/---+/).map(t => t.trim()).filter(t => t.length > 0);
    
    this.logger.debug(`Se encontraron ${tarjetas.length} tarjetas separadas`);
    
    for (const tarjeta of tarjetas) {
      const contenidoLimpio = tarjeta.trim();
      
      const tienePregunta = /PREGUNTA\s*:/i.test(contenidoLimpio);
      const tieneRespuesta = /RESPUESTA\s*:/i.test(contenidoLimpio);
      
      if (tienePregunta && tieneRespuesta) {
        flashcards.push({
          tipo: TipoApunte.FLASHCARD,
          contenido: contenidoLimpio
        });
        this.logger.debug(`✅ Flashcard válida parseada`);
      }
    }

    if (flashcards.length === 0) {
      this.logger.warn('Intentando método alternativo de parseo...');
      
      const preguntaPattern = /PREGUNTA\s*:([^\n]+(?:\n(?!PREGUNTA|RESPUESTA)[^\n]+)*)/gi;
      const respuestaPattern = /RESPUESTA\s*:([^\n]+(?:\n(?!PREGUNTA|RESPUESTA)[^\n]+)*)/gi;
      
      const preguntas = [...texto.matchAll(preguntaPattern)];
      const respuestas = [...texto.matchAll(respuestaPattern)];
      
      const minLength = Math.min(preguntas.length, respuestas.length);
      
      for (let i = 0; i < minLength; i++) {
        flashcards.push({
          tipo: TipoApunte.FLASHCARD,
          contenido: `PREGUNTA: ${preguntas[i][1].trim()}\nRESPUESTA: ${respuestas[i][1].trim()}`
        });
      }
    }

    this.logger.log(`📝 Se parsearon ${flashcards.length} flashcards correctamente`);
    return flashcards;
  }

  /**
   * Genera mapa conceptual
   */
  private async generarMapaConceptual(transcripcion: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Eres un profesor experto en crear mapas conceptuales educativos claros y bien estructurados. 
IMPORTANTE: SIEMPRE respondes en español y sigues el formato visual especificado.`
      },
      {
        role: 'user',
        content: `A partir del siguiente contenido de clase, genera un mapa conceptual en formato de texto estructurado.

FORMATO REQUERIDO (usa estos símbolos exactos):

CONCEPTO PRINCIPAL: [concepto central]
├─ Subconcepto 1: [descripción breve]
│  ├─ Detalle 1.1: [explicación]
│  └─ Detalle 1.2: [explicación]
├─ Subconcepto 2: [descripción breve]
│  ├─ Detalle 2.1: [explicación]
│  └─ Detalle 2.2: [explicación]
└─ Subconcepto 3: [descripción breve]
   └─ Detalle 3.1: [explicación]

Contenido de la clase:
${transcripcion}

Genera el mapa conceptual en español:`
      }
    ];

    return await this.iaService.generateChatCompletion(messages, {
      temperature: 0.6,
      max_tokens: 1000,
      stop: ['Usuario:', 'Human:', 'Assistant:']
    });
  }

  /**
   * Busca todos los apuntes de un usuario específico
   */
  async findByUser(userId: number): Promise<ApunteIa[]> {
    try {
      this.logger.log(`Buscando apuntes del usuario ${userId}`);
      
      const apuntes = await this.apunteRepo.find({
        where: {
          user: { id: userId }
        },
        relations: ['transcripcion', 'temas'],
        order: {
          createdAt: 'DESC'
        }
      });

      this.logger.log(`Se encontraron ${apuntes.length} apuntes para el usuario ${userId}`);
      return apuntes;
    } catch (error) {
      this.logger.error(`Error al buscar apuntes del usuario ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Busca un apunte específico por ID
   */
  async findOne(id: number): Promise<ApunteIa> {
    try {
      this.logger.log(`Buscando apunte con ID ${id}`);
      
      const apunte = await this.apunteRepo.findOne({
        where: { id },
        relations: ['transcripcion', 'temas']
      });

      if (!apunte) {
        throw new Error(`Apunte con ID ${id} no encontrado`);
      }

      return apunte;
    } catch (error) {
      this.logger.error(`Error al buscar apunte ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Actualiza un apunte existente
   */
  async update(id: number, updateApunteIaDto: UpdateApunteIaDto): Promise<ApunteIa> {
    try {
      this.logger.log(`Actualizando apunte ${id}`);
      
      const apunte = await this.findOne(id);
      
      // Actualizar solo los campos proporcionados
      if (updateApunteIaDto.titulo !== undefined) {
        apunte.titulo = updateApunteIaDto.titulo;
      }
      
      if (updateApunteIaDto.contenidoResumen !== undefined) {
        apunte.contenido = updateApunteIaDto.contenidoResumen;
      }
      
      if (updateApunteIaDto.tipo !== undefined) {
        apunte.tipo = updateApunteIaDto.tipo;
      }

      const actualizado = await this.apunteRepo.save(apunte);
      this.logger.log(`✅ Apunte ${id} actualizado exitosamente`);
      
      return actualizado;
    } catch (error) {
      this.logger.error(`Error al actualizar apunte ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Elimina un apunte (soft delete)
   */
  async remove(id: number): Promise<void> {
    try {
      this.logger.log(`Eliminando apunte ${id}`);
      
      const apunte = await this.findOne(id);
      
      // Soft delete usando TypeORM
      await this.apunteRepo.softRemove(apunte);
      
      this.logger.log(`✅ Apunte ${id} eliminado exitosamente`);
    } catch (error) {
      this.logger.error(`Error al eliminar apunte ${id}:`, error.message);
      throw error;
    }
  }
}