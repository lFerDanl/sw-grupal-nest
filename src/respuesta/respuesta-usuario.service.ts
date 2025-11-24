import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRespuestaUsuarioDto } from './dto/create-respuesta-usuario.dto';
import { UpdateRespuestaUsuarioDto } from './dto/update-respuesta-usuario.dto';
import { RespuestaUsuario } from './entities/respuesta-usuario.entity';
import { PreguntaIa } from '../pregunta-ia/entities/pregunta-ia.entity';
import { SesionEstudio } from '../sesion-estudio/entities/sesion-estudio.entity';
import { User } from '../users/entities/user.entity';
import { IAService } from '../ia/ia.service';

enum TipoPregunta {
  OPCION_MULTIPLE = 'opcion_multiple',
  VERDADERO_FALSO = 'verdadero_falso',
  ABIERTA = 'abierta'
}

enum EstadoSesion {
  EN_PROGRESO = 'en_progreso',
  COMPLETADA = 'completada',
  ABANDONADA = 'abandonada'
}

@Injectable()
export class RespuestaUsuarioService {
  private readonly logger = new Logger(RespuestaUsuarioService.name);
  
  constructor(
    @InjectRepository(RespuestaUsuario)
    private respuestaRepository: Repository<RespuestaUsuario>,
    @InjectRepository(PreguntaIa)
    private preguntaRepository: Repository<PreguntaIa>,
    @InjectRepository(SesionEstudio)
    private sesionRepository: Repository<SesionEstudio>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private iaService: IAService,
  ) {}

  /**
   * ✅ MÉTODO PRINCIPAL: Crea respuesta Y actualiza sesión correctamente
   */
  async create(createRespuestaDto: CreateRespuestaUsuarioDto) {
    // 1. Validar pregunta
    const pregunta = await this.preguntaRepository.findOne({
      where: { id: createRespuestaDto.idPregunta },
    });

    if (!pregunta) {
      throw new NotFoundException(`Pregunta con ID ${createRespuestaDto.idPregunta} no encontrada`);
    }

    // 2. Validar usuario
    const usuario = await this.userRepository.findOne({
      where: { id: createRespuestaDto.idUsuario },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${createRespuestaDto.idUsuario} no encontrado`);
    }

    // 3. Validar sesión
    const sesion = await this.sesionRepository.findOne({
      where: { id: createRespuestaDto.idSesion },
      relations: ['usuario']
    });

    if (!sesion) {
      throw new NotFoundException(`Sesión de estudio con ID ${createRespuestaDto.idSesion} no encontrada`);
    }

    // 4. Validar que la sesión pertenece al usuario
    if (sesion.usuario.id !== usuario.id) {
      throw new BadRequestException('La sesión no pertenece al usuario especificado');
    }

    // 5. Validar estado de la sesión
    if (sesion.estado !== EstadoSesion.EN_PROGRESO) {
      throw new BadRequestException('Solo se pueden registrar respuestas en sesiones en progreso');
    }

    const respuestaExistente = await this.respuestaRepository.findOne({
      where: {
        pregunta: { id: pregunta.id },
        usuario: { id: usuario.id },
        sesion: { id: sesion.id }
      }
    });

    if (respuestaExistente) {
      throw new BadRequestException('Ya existe una respuesta para esta pregunta en esta sesión');
    }

    // 7. Evaluar si la respuesta es correcta
    const evaluacion = await this.evaluarRespuesta(
      createRespuestaDto.respuestaUsuario,
      pregunta
    );

    // 8. Crear y guardar la respuesta
    const respuesta = this.respuestaRepository.create({
      respuestaUsuario: createRespuestaDto.respuestaUsuario,
      correcta: evaluacion.correcta,
      puntuacion: evaluacion.puntuacion,
      pregunta,
      usuario,
      sesion,
    });

    const respuestaGuardada = await this.respuestaRepository.save(respuesta);

    // 9. ✅ ACTUALIZAR LA SESIÓN
    const sesionActualizada = await this.actualizarSesionEstudio(sesion, evaluacion.correcta);

    this.logger.log(
      `✅ Respuesta registrada - Usuario: ${usuario.id}, ` +
      `Pregunta: ${pregunta.id}, Correcta: ${evaluacion.correcta}, ` +
      `Progreso: ${sesionActualizada.progreso}%, ` +
      `Resultado: ${sesionActualizada.resultadoEvaluacion}%`
    );

    return {
      respuesta: {
        id: respuestaGuardada.id,
        respuestaUsuario: respuestaGuardada.respuestaUsuario,
        correcta: respuestaGuardada.correcta,
        puntuacion: respuestaGuardada.puntuacion,
        createdAt: respuestaGuardada.createdAt
      },
      sesion: {
        id: sesionActualizada.id,
        progreso: sesionActualizada.progreso,
        preguntasRespondidas: sesionActualizada.preguntasRespondidas,
        preguntasCorrectas: sesionActualizada.preguntasCorrectas,
        totalPreguntas: sesionActualizada.totalPreguntas,
        resultadoEvaluacion: sesionActualizada.resultadoEvaluacion,
        estado: sesionActualizada.estado
      },
      evaluacion: {
        correcta: evaluacion.correcta,
        puntuacion: evaluacion.puntuacion,
        explicacion: pregunta.explicacion,
        retroalimentacion: evaluacion.retroalimentacion
      }
    };
  }

  /**
   * Evalúa si una respuesta es correcta según el tipo de pregunta
   */
  private async evaluarRespuesta(
    respuestaUsuario: string, 
    pregunta: PreguntaIa
  ): Promise<{ correcta: boolean, puntuacion: number, retroalimentacion?: string }> {
    if (pregunta.tipo === TipoPregunta.OPCION_MULTIPLE) {
      // Para opción múltiple, comparar índice
      const indiceRespuesta = parseInt(respuestaUsuario);
      const correcta = indiceRespuesta === pregunta.respuestaCorrecta;
      return { correcta, puntuacion: correcta ? 1 : 0 };
    } 
    
    if (pregunta.tipo === TipoPregunta.ABIERTA) {
      // 🤖 Para preguntas abiertas, usar IA para evaluar
      return await this.evaluarRespuestaAbiertaConIA(
        respuestaUsuario, 
        pregunta.respuestaEsperada,
        pregunta.enunciado
      );
    }

    return { correcta: false, puntuacion: 0 };
  }

  /**
   * 🤖 Evalúa una respuesta abierta usando IA
   * Analiza el contexto, conceptos clave y coherencia de la respuesta
   */
  private async evaluarRespuestaAbiertaConIA(
    respuestaUsuario: string, 
    respuestaEsperada: string,
    enunciado: string
  ): Promise<{ correcta: boolean, puntuacion: number, retroalimentacion: string }> {
    // Validación básica
    const respuestaLimpia = respuestaUsuario.trim();
    if (!respuestaLimpia || respuestaLimpia.length < 3) {
      return { 
        correcta: false, 
        puntuacion: 0,
        retroalimentacion: 'La respuesta está vacía o es demasiado corta.'
      };
    }

    try {
      // Construir el prompt para la IA
      const prompt = `Eres un evaluador académico experto. Debes evaluar la respuesta de un estudiante a una pregunta abierta.

**PREGUNTA:**
${enunciado}

**RESPUESTA ESPERADA (referencia):**
${respuestaEsperada}

**RESPUESTA DEL ESTUDIANTE:**
${respuestaUsuario}

**INSTRUCCIONES DE EVALUACIÓN:**
Evalúa la respuesta del estudiante comparándola con la respuesta esperada. Considera:
1. ¿Contiene los conceptos clave principales?
2. ¿Es coherente y tiene sentido en el contexto?
3. ¿Demuestra comprensión del tema?
4. No exijas una respuesta idéntica, valora respuestas correctas aunque estén redactadas diferente

**CRITERIOS DE CALIFICACIÓN:**
- **puntuacion:** valor numérico entre 0.0 y 1.0 (por ejemplo, 0.85).
- **correcta:** valor booleano (true si la puntuación es 0.6 o superior, false si es menor).
- **retroalimentacion:** texto breve (máximo 2 líneas) que indique qué hizo bien o qué puede mejorar el estudiante.


**FORMATO DE RESPUESTA (JSON):**
{
  "puntuacion": {0.0},
  "correcta": false,
  "retroalimentacion": ""
}`;

      this.logger.debug('🤖 Enviando respuesta abierta a IA para evaluación');

      // Llamar a la IA
      const iaResponse = await this.iaService.generateChatCompletion(
        [
          {
            role: 'system',
            content: 'Eres un evaluador académico objetivo y justo. Respondes únicamente en formato JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        {
          temperature: 0.3, // Baja temperatura para respuestas consistentes
          max_tokens: 500
        }
      );

      // Parsear la respuesta JSON
      const evaluacion = this.parseEvaluacionIA(iaResponse);
      
      this.logger.log(
        `🤖 IA evaluó respuesta abierta - ` +
        `Puntuación: ${evaluacion.puntuacion}, ` +
        `Correcta: ${evaluacion.correcta}`
      );

      return evaluacion;

    } catch (error) {
      this.logger.error('❌ Error al evaluar con IA:', error.message);
      
      // Fallback: usar método simple de palabras clave
      this.logger.warn('⚠️ Usando evaluación de fallback (palabras clave)');
      return this.evaluarRespuestaAbiertaFallback(respuestaUsuario, respuestaEsperada);
    }
  }

  /**
   * Parsea la respuesta JSON de la IA
   */
  private parseEvaluacionIA(iaResponse: string): { 
    correcta: boolean, 
    puntuacion: number, 
    retroalimentacion: string 
  } {
    try {
      // Intentar extraer JSON de la respuesta
      const jsonMatch = iaResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se encontró JSON en la respuesta');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validar y normalizar
      const puntuacion = Math.max(0, Math.min(1, parseFloat(parsed.puntuacion) || 0));
      const correcta = parsed.correcta === true || puntuacion >= 0.6;
      const retroalimentacion = (parsed.retroalimentacion || '').substring(0, 200);

      return {
        correcta,
        puntuacion,
        retroalimentacion: retroalimentacion || 'Evaluación completada.'
      };
    } catch (error) {
      this.logger.warn('⚠️ Error al parsear JSON de IA, usando valores por defecto');
      
      // Si la respuesta contiene palabras positivas, dar puntuación moderada
      const esPositiva = /correct[ao]|bien|adecuad[ao]|acertad[ao]/i.test(iaResponse);
      const puntuacion = esPositiva ? 0.7 : 0.3;
      
      return {
        correcta: esPositiva,
        puntuacion,
        retroalimentacion: iaResponse.substring(0, 200) || 'Evaluación completada.'
      };
    }
  }

  /**
   * Método de fallback: evaluación simple por palabras clave
   * Se usa solo si la IA falla
   */
  private evaluarRespuestaAbiertaFallback(
    respuestaUsuario: string, 
    respuestaEsperada: string
  ): { correcta: boolean, puntuacion: number, retroalimentacion: string } {
    const respuestaUsuarioLower = respuestaUsuario.toLowerCase().trim();
    const respuestaEsperadaLower = respuestaEsperada.toLowerCase().trim();

    // Palabras comunes a filtrar
    const palabrasComunes = [
      'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 
      'y', 'o', 'que', 'es', 'por', 'para', 'con', 'a', 'como'
    ];

    // Extraer palabras clave
    const palabrasClaveEsperadas = respuestaEsperadaLower
      .split(/\s+/)
      .filter(palabra => palabra.length > 2 && !palabrasComunes.includes(palabra));

    if (palabrasClaveEsperadas.length === 0) {
      return { 
        correcta: false, 
        puntuacion: 0,
        retroalimentacion: 'No se pudo evaluar la respuesta esperada.'
      };
    }

    // Contar palabras clave encontradas
    const palabrasEncontradas = palabrasClaveEsperadas.filter(
      palabra => respuestaUsuarioLower.includes(palabra)
    ).length;
    
    // Calcular puntuación
    const puntuacion = palabrasEncontradas / palabrasClaveEsperadas.length;
    const correcta = puntuacion >= 0.6; // 60% de similitud

    const retroalimentacion = correcta
      ? `Respuesta correcta. Incluye ${palabrasEncontradas} de ${palabrasClaveEsperadas.length} conceptos clave.`
      : `Respuesta incompleta. Incluye solo ${palabrasEncontradas} de ${palabrasClaveEsperadas.length} conceptos clave esperados.`;

    return { correcta, puntuacion, retroalimentacion };
  }

  /**
   * ✅ ACTUALIZACIÓN CORRECTA DE LA SESIÓN
   */
  private async actualizarSesionEstudio(
    sesion: SesionEstudio, 
    respuestaCorrecta: boolean
  ): Promise<SesionEstudio> {
    // Incrementar preguntas respondidas
    sesion.preguntasRespondidas += 1;

    // Incrementar correctas si aplica
    if (respuestaCorrecta) {
      sesion.preguntasCorrectas += 1;
    }

    // Calcular progreso (porcentaje de preguntas respondidas)
    if (sesion.totalPreguntas > 0) {
      sesion.progreso = Math.round(
        (sesion.preguntasRespondidas / sesion.totalPreguntas) * 100 * 100
      ) / 100;
    }

    // Calcular resultado de evaluación (porcentaje de aciertos)
    if (sesion.preguntasRespondidas > 0) {
      sesion.resultadoEvaluacion = Math.round(
        (sesion.preguntasCorrectas / sesion.preguntasRespondidas) * 100 * 100
      ) / 100;
    }

    // ✅ Marcar como completada si terminó todas las preguntas
    if (sesion.totalPreguntas > 0 && sesion.preguntasRespondidas >= sesion.totalPreguntas) {
      sesion.estado = EstadoSesion.COMPLETADA;
      this.logger.log(`🎉 Sesión ${sesion.id} completada - Resultado: ${sesion.resultadoEvaluacion}%`);
    }

    // Guardar cambios
    return await this.sesionRepository.save(sesion);
  }

  /**
   * Obtiene todas las respuestas
   */
  async findAll() {
    return this.respuestaRepository.find({
      relations: ['pregunta', 'usuario'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Obtiene una respuesta por su ID
   */
  async findOne(id: number) {
    const respuesta = await this.respuestaRepository.findOne({
      where: { id },
      relations: ['pregunta', 'usuario'],
    });

    if (!respuesta) {
      throw new NotFoundException(`Respuesta con ID ${id} no encontrada`);
    }

    return respuesta;
  }

  /**
   * Obtiene todas las respuestas de un usuario específico
   */
  async findByUsuario(usuarioId: number) {
    const usuario = await this.userRepository.findOne({
      where: { id: usuarioId }
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`);
    }

    return this.respuestaRepository.find({
      where: { usuario: { id: usuarioId } },
      relations: ['pregunta', 'usuario'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Obtiene todas las respuestas de una sesión de estudio específica
   */
  async findBySesion(sesionId: number) {
    const sesion = await this.sesionRepository.findOne({
      where: { id: sesionId },
      relations: ['usuario', 'quiz', 'quiz.preguntas']
    });

    if (!sesion) {
      throw new NotFoundException(`Sesión de estudio con ID ${sesionId} no encontrada`);
    }

    if (!sesion.quiz) {
      return [];
    }

    return this.respuestaRepository.find({
      where: {
        sesion: { id: sesion.id }
      },
      relations: ['pregunta', 'usuario'],
      order: { createdAt: 'ASC' }
    });
  }

  /**
   * Actualiza una respuesta existente
   */
  async update(id: number, updateRespuestaDto: UpdateRespuestaUsuarioDto) {
    const respuesta = await this.respuestaRepository.findOne({
      where: { id },
      relations: ['pregunta']
    });

    if (!respuesta) {
      throw new NotFoundException(`Respuesta con ID ${id} no encontrada`);
    }

    // Actualizar la respuesta
    if (updateRespuestaDto.respuestaUsuario !== undefined) {
      respuesta.respuestaUsuario = updateRespuestaDto.respuestaUsuario;

      // Re-evaluar
      const evaluacion = await this.evaluarRespuesta(
        updateRespuestaDto.respuestaUsuario,
        respuesta.pregunta
      );

      respuesta.correcta = evaluacion.correcta;
      respuesta.puntuacion = evaluacion.puntuacion;
    }

    return this.respuestaRepository.save(respuesta);
  }

  /**
   * Elimina una respuesta (soft delete)
   */
  async remove(id: number) {
    const respuesta = await this.respuestaRepository.findOne({
      where: { id },
    });

    if (!respuesta) {
      throw new NotFoundException(`Respuesta con ID ${id} no encontrada`);
    }

    return this.respuestaRepository.softDelete(id);
  }

  /**
   * Obtiene estadísticas de un usuario
   */
  async getEstadisticasUsuario(usuarioId: number, temaId?: number) {
    const usuario = await this.userRepository.findOne({
      where: { id: usuarioId }
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`);
    }

    const queryBuilder = this.respuestaRepository
      .createQueryBuilder('respuesta')
      .leftJoinAndSelect('respuesta.pregunta', 'pregunta')
      .leftJoinAndSelect('pregunta.quiz', 'quiz')
      .leftJoinAndSelect('quiz.tema', 'tema')
      .where('respuesta.usuario.id = :usuarioId', { usuarioId });

    if (temaId) {
      queryBuilder.andWhere('tema.id = :temaId', { temaId });
    }

    const respuestas = await queryBuilder.getMany();

    const totalRespuestas = respuestas.length;
    const respuestasCorrectas = respuestas.filter(r => r.correcta).length;
    const porcentajeAcierto = totalRespuestas > 0 
      ? Math.round((respuestasCorrectas / totalRespuestas) * 100 * 100) / 100
      : 0;

    return {
      totalRespuestas,
      respuestasCorrectas,
      respuestasIncorrectas: totalRespuestas - respuestasCorrectas,
      porcentajeAcierto
    };
  }
}