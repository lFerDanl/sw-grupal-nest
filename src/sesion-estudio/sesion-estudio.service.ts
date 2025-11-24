import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CreateSesionEstudioDto } from './dto/create-sesion-estudio.dto';
import { UpdateSesionEstudioDto } from './dto/update-sesion-estudio.dto';
import { SesionEstudio } from './entities/sesion-estudio.entity';
import { User } from '../users/entities/user.entity';
import { QuizIa } from '../quiz-ia/entities/quiz-ia.entity';
import { TemaIa } from '../tema-ia/entities/tema-ia.entity';
import { EmbeddingIaService } from '../embedding-ia/embedding-ia.service';
import { RespuestaUsuario } from '../respuesta/entities/respuesta-usuario.entity';

@Injectable()
export class SesionEstudioService {
  constructor(
    @InjectRepository(SesionEstudio)
    private sesionRepository: Repository<SesionEstudio>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(QuizIa)
    private quizRepository: Repository<QuizIa>,
    @InjectRepository(TemaIa)
    private temaRepository: Repository<TemaIa>,
    @InjectRepository(RespuestaUsuario)
    private respuestaRepository: Repository<RespuestaUsuario>,
    private embeddingService: EmbeddingIaService
  ) {}

  /**
   * Crea una nueva sesión de estudio
   */
  async create(createSesionEstudioDto: CreateSesionEstudioDto) {
    const usuario = await this.userRepository.findOne({
      where: { id: createSesionEstudioDto.usuarioId }
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${createSesionEstudioDto.usuarioId} no encontrado`);
    }

    let quiz;
    let totalPreguntas = 0;

    // Si se proporciona un quiz, lo asociamos a la sesión
    if (createSesionEstudioDto.quizId) {
      quiz = await this.quizRepository.findOne({
        where: { id: createSesionEstudioDto.quizId },
        relations: ['preguntas']
      });

      if (!quiz) {
        throw new NotFoundException(`Quiz con ID ${createSesionEstudioDto.quizId} no encontrado`);
      }

      totalPreguntas = quiz.preguntas.length;
    }

    // Crear la sesión de estudio
    const sesion = this.sesionRepository.create({
      usuario,
      quiz,
      totalPreguntas,
      progreso: 0,
      preguntasRespondidas: 0,
      preguntasCorrectas: 0,
      resultadoEvaluacion: 0
    });

    return this.sesionRepository.save(sesion);
  }

  /**
   * Obtiene todas las sesiones de estudio
   */
  findAll() {
    return this.sesionRepository.find({
      relations: ['usuario', 'quiz']
    });
  }

  /**
   * Obtiene una sesión de estudio por su ID
   */
  async findOne(id: number) {
    const sesion = await this.sesionRepository.findOne({
      where: { id },
      relations: ['usuario', 'quiz']
    });

    if (!sesion) {
      throw new NotFoundException(`Sesión de estudio con ID ${id} no encontrada`);
    }

    return sesion;
  }

  /**
   * Actualiza una sesión de estudio
   */
  async update(id: number, updateSesionEstudioDto: UpdateSesionEstudioDto) {
    const sesion = await this.sesionRepository.findOne({
      where: { id }
    });

    if (!sesion) {
      throw new NotFoundException(`Sesión de estudio con ID ${id} no encontrada`);
    }

    // Actualizar solo los campos permitidos
    if (updateSesionEstudioDto.duracionTotal !== undefined) {
      sesion.duracionTotal = updateSesionEstudioDto.duracionTotal;
    }

    return this.sesionRepository.save(sesion);
  }

  /**
   * Elimina una sesión de estudio
   */
  async remove(id: number) {
    const sesion = await this.sesionRepository.findOne({
      where: { id }
    });

    if (!sesion) {
      throw new NotFoundException(`Sesión de estudio con ID ${id} no encontrada`);
    }

    return this.sesionRepository.softDelete(id);
  }

  /**
   * Obtiene recomendaciones personalizadas para un usuario basadas en su desempeño
   * Analiza las preguntas que respondió incorrectamente y busca temas similares
   */
  async getRecomendaciones(usuarioId: number) {
    // Obtener las últimas sesiones de estudio del usuario
    const sesiones = await this.sesionRepository.find({
      where: { usuario: { id: usuarioId } },
      relations: ['quiz'],
      order: { createdAt: 'DESC' },
      take: 10 // Analizar las últimas 10 sesiones
    });

    if (sesiones.length === 0) {
      return { 
        recomendaciones: [],
        mensaje: 'No hay sesiones de estudio previas para generar recomendaciones'
      };
    }

    // Obtener todas las respuestas incorrectas del usuario en las últimas sesiones
    const respuestasIncorrectas = await this.respuestaRepository.find({
      where: { 
        usuario: { id: usuarioId },
        correcta: false
      },
      relations: ['pregunta', 'pregunta.quiz', 'pregunta.quiz.apunte'],
      order: { createdAt: 'DESC' },
      take: 30 // Últimas 30 respuestas incorrectas
    });

    if (respuestasIncorrectas.length === 0) {
      return { 
        recomendaciones: [],
        mensaje: 'No hay respuestas incorrectas. ¡Excelente desempeño!'
      };
    }

    // Estrategia 1: Recopilar los temas de los quizzes con respuestas incorrectas
    const temasRelacionados = new Set<TemaIa>();
    const apunteIds = new Set<number>();
    respuestasIncorrectas.forEach(respuesta => {
      const apId = respuesta.pregunta?.quiz?.apunte?.id;
      if (apId) apunteIds.add(apId);
    });
    if (apunteIds.size > 0) {
      const temasApuntes = await this.temaRepository.find({
        where: { apunte: { id: In(Array.from(apunteIds)) } }
      });
      temasApuntes.forEach(tema => temasRelacionados.add(tema));
    }

    // Estrategia 2: Crear un texto de consulta basado en los enunciados de preguntas falladas
    const enunciadosPreguntas = respuestasIncorrectas
      .map(respuesta => respuesta.pregunta?.enunciado)
      .filter(enunciado => enunciado)
      .slice(0, 10) // Tomar máximo 10 enunciados para no sobrecargar
      .join(' ');

    let recomendaciones: {
      temaId: number;
      titulo: string;
      descripcion: string;
      razon: string;
      similitud: number;
    }[] = [];

    // Si tenemos temas relacionados directamente, añadirlos
    if (temasRelacionados.size > 0) {
      const temasArray = Array.from(temasRelacionados);
      recomendaciones = temasArray.slice(0, 5).map(tema => ({
        temaId: tema.id,
        titulo: tema.tituloTema,
        descripcion: tema.descripcion,
        razon: 'Tema relacionado con preguntas que respondiste incorrectamente',
        similitud: 1.0
      }));
    }

    // Si tenemos enunciados, buscar temas similares usando embeddings
    if (enunciadosPreguntas && recomendaciones.length < 5) {
      try {
        const temasSimilares = await this.embeddingService.findSimilarTemas(
          enunciadosPreguntas, 
          5 - recomendaciones.length
        );

        // Añadir temas similares que no estén ya en las recomendaciones
        const idsYaRecomendados = new Set(recomendaciones.map(r => r.temaId));
        
        const temasNuevos = temasSimilares
          .filter(resultado => !idsYaRecomendados.has(resultado.tema?.id))
          .map(resultado => ({
            temaId: resultado.tema.id,
            titulo: resultado.tema.tituloTema,
            descripcion: resultado.tema.descripcion,
            razon: 'Tema similar a conceptos donde tuviste dificultades',
            similitud: resultado.similarityScore
          }));

        recomendaciones = [...recomendaciones, ...temasNuevos];
      } catch (error) {
        console.error('Error al buscar temas similares:', error);
      }
    }

    // Calcular estadísticas adicionales
    const estadisticas = {
      totalRespuestasIncorrectas: respuestasIncorrectas.length,
      sesionesAnalizadas: sesiones.length,
      porcentajeExito: sesiones.length > 0 
        ? sesiones.reduce((acc, s) => acc + Number(s.resultadoEvaluacion), 0) / sesiones.length 
        : 0
    };

    return { 
      recomendaciones: recomendaciones.slice(0, 5),
      estadisticas,
      mensaje: recomendaciones.length > 0 
        ? 'Recomendaciones generadas basadas en tu desempeño'
        : 'No se encontraron temas relacionados para recomendar'
    };
  }

  async getRecomendacionesPorQuiz(usuarioId: number, quizId: number) {
    const sesiones = await this.sesionRepository.find({
      where: { usuario: { id: usuarioId }, quiz: { id: quizId } },
      relations: ['quiz'],
      order: { createdAt: 'DESC' },
    });

    if (sesiones.length === 0) {
      return { recomendaciones: [], estadisticas: { sesionesAnalizadas: 0, porcentajeExito: 0, totalRespuestasIncorrectas: 0 }, mensaje: 'Sin sesiones para este quiz' };
    }

    const sesionIds = sesiones.map(s => s.id);

    const respuestasIncorrectas = await this.respuestaRepository.find({
      where: { usuario: { id: usuarioId }, correcta: false, sesion: { id: In(sesionIds) } },
      relations: ['pregunta', 'pregunta.quiz', 'pregunta.quiz.apunte', 'sesion'],
      order: { createdAt: 'DESC' },
      take: 50,
    });

    if (respuestasIncorrectas.length === 0) {
      const porcentajeExito = sesiones.reduce((acc, s) => acc + Number(s.resultadoEvaluacion || 0), 0) / sesiones.length;
      return { recomendaciones: [], estadisticas: { sesionesAnalizadas: sesiones.length, porcentajeExito, totalRespuestasIncorrectas: 0 }, mensaje: 'Sin respuestas incorrectas en este quiz' };
    }

    const apunteIds = new Set<number>();
    respuestasIncorrectas.forEach(r => {
      const apId = r.pregunta?.quiz?.apunte?.id;
      if (apId) apunteIds.add(apId);
    });

    let recomendaciones: { temaId: number; titulo: string; descripcion: string; razon: string; similitud: number }[] = [];

    if (apunteIds.size > 0) {
      const temasApuntes = await this.temaRepository.find({ where: { apunte: { id: In(Array.from(apunteIds)) } } });
      recomendaciones = temasApuntes.slice(0, 5).map(tema => ({ temaId: tema.id, titulo: tema.tituloTema, descripcion: tema.descripcion, razon: 'Relacionado con preguntas falladas del quiz', similitud: 1.0 }));
    }

    // Quitar lógica de embeddings según requerimiento

    const estadisticas = {
      totalRespuestasIncorrectas: respuestasIncorrectas.length,
      sesionesAnalizadas: sesiones.length,
      porcentajeExito: sesiones.reduce((acc, s) => acc + Number(s.resultadoEvaluacion || 0), 0) / sesiones.length,
    };

    const erroresPorSesion = new Map<number, number>();
    respuestasIncorrectas.forEach(r => {
      const sid = r.sesion?.id;
      if (!sid) return;
      erroresPorSesion.set(sid, (erroresPorSesion.get(sid) || 0) + 1);
    });

    const sesionesDetalle = sesiones.map(s => ({
      fechaInicio: s.fechaInicio,
      errores: erroresPorSesion.get(s.id) || 0,
      resultadoEvaluacion: Number(s.resultadoEvaluacion || 0),
    }));

    const explicacion = sesiones.length > 0
      ? `Se analizaron ${sesiones.length} sesiones de este quiz. Registraste ${estadisticas.totalRespuestasIncorrectas} respuestas incorrectas en total. Debes mejorar en los siguientes temas:`
      : 'No hay sesiones para este quiz.';

    return {
      explicacion,
      sesionesDetalle,
      recomendaciones: recomendaciones.slice(0, 5),
      estadisticas,
      mensaje: recomendaciones.length > 0 ? 'Recomendaciones para este quiz' : 'Sin recomendaciones para este quiz'
    };
  }
}