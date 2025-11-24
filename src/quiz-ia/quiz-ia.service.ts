import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GenerateQuizFromTemasDto } from './dto/generate-quiz-from-temas.dto';
import { QuizIa, TipoQuiz, Dificultad } from './entities/quiz-ia.entity';
import { TemaIa } from '../tema-ia/entities/tema-ia.entity';
import { ApunteIa } from '../apunte-ia/entities/apunte-ia.entity';
import { PreguntaIa, TipoPregunta } from '../pregunta-ia/entities/pregunta-ia.entity';
import { IAService } from '../ia/ia.service';
import { ChatMessage } from '../ia/interfaces/chat-message.interface';

@Injectable()
export class QuizIaService {
  private readonly logger = new Logger(QuizIaService.name);

  constructor(
    private readonly iaService: IAService,
    @InjectRepository(QuizIa)
    private readonly quizRepo: Repository<QuizIa>,
    @InjectRepository(TemaIa)
    private readonly temaRepo: Repository<TemaIa>,
    @InjectRepository(ApunteIa)
    private readonly apunteRepo: Repository<ApunteIa>,
    @InjectRepository(PreguntaIa)
    private readonly preguntaRepo: Repository<PreguntaIa>,
  ) {}

  /**
   * Método interno para generar un quiz a partir de una lista de temas
   */
  public async generateQuizFromApunte(dto: GenerateQuizFromTemasDto): Promise<any> {
    const apunte = await this.apunteRepo.findOne({ where: { id: dto.apunteId } });
    if (!apunte) {
      throw new NotFoundException('Apunte no encontrado');
    }

    const temas = await this.temaRepo.find({
      where: { apunte: { id: apunte.id } },
      order: { orden: 'ASC' }
    });

    if (temas.length === 0) {
      throw new NotFoundException('El apunte no tiene temas asociados');
    }

    const quiz = this.quizRepo.create({
      tipo: dto.tipo || TipoQuiz.MULTIPLE,
      dificultad: dto.dificultad || Dificultad.MEDIA,
      apunte: apunte
    });

    const savedQuiz = await this.quizRepo.save(quiz);

    try {
      const preguntas = await this.generatePreguntasForQuiz(savedQuiz, temas);
      this.logger.log(`✅ Quiz generado exitosamente con ${preguntas.length} preguntas`);
      return preguntas;
    } catch (error) {
      await this.quizRepo.remove(savedQuiz);
      this.logger.error(`❌ Error generando preguntas para quiz: ${error.message}`);
      throw error;
    }
  }

  /**
   * Genera preguntas para un quiz utilizando IA
   */
  private async generatePreguntasForQuiz(quiz: QuizIa, temas: TemaIa[]): Promise<PreguntaIa[]> {
    // Preparar el contenido para la IA combinando todos los temas
    const titulosTemas = temas.map(tema => tema.tituloTema).join(', ');
    
    // Construir un texto con el contenido de todas las secciones de todos los temas (Se quito para no mandar muchos tokens)
    let contenidoSecciones = '';
    
    for (const tema of temas) {
      const estructuraTema = tema.estructura?.secciones || [];
      
      contenidoSecciones += `\n\n## TEMA: ${tema.tituloTema}\n`;
      contenidoSecciones += estructuraTema
        .map(seccion => `${seccion.titulo}`)
        .join('\n\n');
    }

    // Determinar el número de preguntas según la dificultad y cantidad de temas
    const preguntasPorTema = quiz.dificultad === Dificultad.FACIL ? 3 : 
                          quiz.dificultad === Dificultad.MEDIA ? 4 : 5;
    
    const numPreguntas = Math.min(preguntasPorTema * temas.length, 15); // Máximo 15 preguntas

    // Calcular distribución para tipo MIXTO (60% múltiple, 40% abiertas)
    let numMultiples = numPreguntas;
    let numAbiertas = 0;
    
    if (quiz.tipo === TipoQuiz.MIXTO) {
      numMultiples = Math.ceil(numPreguntas * 0.6);
      numAbiertas = numPreguntas - numMultiples;
    }

    // Construir el tipo de preguntas para el prompt
    let tipoInstruccion = '';
    if (quiz.tipo === TipoQuiz.MULTIPLE) {
      tipoInstruccion = 'de opción múltiple';
    } else if (quiz.tipo === TipoQuiz.ABIERTA) {
      tipoInstruccion = 'abiertas';
    } else {
      tipoInstruccion = `mixtas (${numMultiples} de opción múltiple y ${numAbiertas} abiertas)`;
    }

    // Construir el formato de ejemplo según el tipo
    let formatoEjemplo = '';
    
    if (quiz.tipo === TipoQuiz.MULTIPLE) {
      formatoEjemplo = `  {\n` +
                      `    "tipo": "multiple",\n` +
                      `    "enunciado": "Texto de la pregunta",\n` +
                      `    "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],\n` +
                      `    "respuestaCorrecta": "Índice de la opción correcta (0-3)",\n` +
                      `    "explicacion": "Explicación de la respuesta correcta"\n` +
                      `  }`;
    } else if (quiz.tipo === TipoQuiz.ABIERTA) {
      formatoEjemplo = `  {\n` +
                      `    "tipo": "abierta",\n` +
                      `    "enunciado": "Texto de la pregunta",\n` +
                      `    "respuestaEsperada": "Texto con la respuesta esperada",\n` +
                      `    "explicacion": "Explicación de la respuesta correcta"\n` +
                      `  }`;
    } else {
      formatoEjemplo = `  // Pregunta de opción múltiple:\n` +
                      `  {\n` +
                      `    "tipo": "multiple",\n` +
                      `    "enunciado": "Texto de la pregunta",\n` +
                      `    "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],\n` +
                      `    "respuestaCorrecta": "Índice de la opción correcta (0-3)",\n` +
                      `    "explicacion": "Explicación de la respuesta correcta"\n` +
                      `  },\n` +
                      `  // Pregunta abierta:\n` +
                      `  {\n` +
                      `    "tipo": "abierta",\n` +
                      `    "enunciado": "Texto de la pregunta",\n` +
                      `    "respuestaEsperada": "Texto con la respuesta esperada",\n` +
                      `    "explicacion": "Explicación de la respuesta correcta"\n` +
                      `  }`;
    }

    // Construir el prompt para la IA
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 
          'Eres un profesor experto que crea preguntas educativas de alta calidad. ' +
          'Genera preguntas basadas en el contenido proporcionado. ' +
          'Devuelve ÚNICAMENTE un array JSON válido con las preguntas, sin texto adicional. ' +
          'NO incluyas explicaciones, comentarios ni razonamiento. SOLO el JSON.'
      },
      {
        role: 'user',
        content: 
          `Crea ${numPreguntas} preguntas ${tipoInstruccion} ` +
          `sobre los siguientes temas: "${titulosTemas}"\n\n` +
          `Secciones de cada tema:\n${contenidoSecciones}\n\n` +
          `Formato requerido (solo JSON):\n` +
          `[\n${formatoEjemplo}\n]\n\n` +
          `Nivel de dificultad: ${quiz.dificultad}\n` +
          `Distribuye las preguntas de manera equilibrada entre todos los temas proporcionados.` +
          (quiz.tipo === TipoQuiz.MIXTO ? 
            `\n\nIMPORTANTE: Debes crear exactamente ${numMultiples} preguntas de opción múltiple y ${numAbiertas} preguntas abiertas. ` +
            `Cada pregunta DEBE incluir el campo "tipo" con valor "multiple" o "abierta".` : '')
      }
    ];

    // Generar las preguntas con la IA
    this.logger.log(`Generando ${numPreguntas} preguntas ${quiz.tipo} de dificultad ${quiz.dificultad}`);
    
    // Calcular tokens necesarios: ~400 tokens por pregunta + buffer
    const estimatedTokens = Math.max(numPreguntas * 500, 6000);
    
    const rawResponse = await this.iaService.generateChatCompletion(messages, {
      temperature: 0.7,
      max_tokens: estimatedTokens
    });

    // Parsear la respuesta (con manejo de JSON incompleto)
    const preguntas = this.parsePreguntasResponse(rawResponse, quiz.tipo, numPreguntas);
    
    // Guardar las preguntas en la base de datos
    const preguntasEntities = preguntas.map(pregunta => {
      const esPreguntaMultiple = pregunta.tipo === 'multiple' || 
                                (quiz.tipo === TipoQuiz.MULTIPLE) ||
                                (quiz.tipo === TipoQuiz.MIXTO && pregunta.opciones);
      
      return this.preguntaRepo.create({
        enunciado: pregunta.enunciado,
        tipo: esPreguntaMultiple ? TipoPregunta.OPCION_MULTIPLE : TipoPregunta.ABIERTA,
        opciones: esPreguntaMultiple ? pregunta.opciones : null,
        respuestaCorrecta: esPreguntaMultiple ? pregunta.respuestaCorrecta : null,
        respuestaEsperada: !esPreguntaMultiple ? pregunta.respuestaEsperada : null,
        explicacion: pregunta.explicacion,
        quiz: quiz
      });
    });

    return await this.preguntaRepo.save(preguntasEntities);
  }

  /**
   * Parsea la respuesta de la IA para extraer las preguntas
   */
  private parsePreguntasResponse(rawResponse: string, tipo: TipoQuiz, numEsperadas: number): any[] {
    try {
      // Limpiar respuesta: remover bloques de código markdown si existen
      let cleanResponse = rawResponse.trim();
      cleanResponse = cleanResponse.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      
      // Intentar extraer JSON de la respuesta
      let jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No se encontró un formato JSON válido en la respuesta');
      }

      let jsonStr = jsonMatch[0];
      
      // 🔧 SOLUCIÓN: Intentar reparar JSON incompleto
      let preguntas: any[];
      let jsonIncompleto = false;
      
      try {
        preguntas = JSON.parse(jsonStr);
      } catch (parseError) {
        this.logger.warn(`JSON incompleto detectado. Intentando reparar...`);
        jsonIncompleto = true;
        
        // Intentar cerrar el JSON incompleto
        jsonStr = this.repairIncompleteJSON(jsonStr);
        
        try {
          preguntas = JSON.parse(jsonStr);
          this.logger.log(`✅ JSON reparado exitosamente. Preguntas recuperadas: ${preguntas.length}`);
        } catch (repairError) {
          this.logger.error(`❌ No se pudo reparar el JSON: ${repairError.message}`);
          throw new Error(`JSON inválido y no reparable: ${parseError.message}`);
        }
      }

      // Validar estructura básica
      if (!Array.isArray(preguntas)) {
        throw new Error('La respuesta no contiene un array de preguntas');
      }

      // Si el JSON estaba incompleto, advertir sobre preguntas faltantes
      if (jsonIncompleto && preguntas.length < numEsperadas) {
        this.logger.warn(
          `⚠️ Se esperaban ${numEsperadas} preguntas pero solo se recuperaron ${preguntas.length} ` +
          `debido a truncamiento. Considera aumentar max_tokens.`
        );
      }

      // Validar cada pregunta
      const preguntasValidadas = preguntas.map((pregunta, index) => {
        if (!pregunta.enunciado) {
          throw new Error(`La pregunta ${index + 1} no tiene enunciado`);
        }

        // Determinar el tipo de pregunta
        const tipoPregunta = pregunta.tipo || 
                            (tipo === TipoQuiz.MULTIPLE ? 'multiple' : 
                            tipo === TipoQuiz.ABIERTA ? 'abierta' : 
                            (pregunta.opciones ? 'multiple' : 'abierta'));

        if (tipoPregunta === 'multiple') {
          if (!Array.isArray(pregunta.opciones) || pregunta.opciones.length < 2) {
            throw new Error(`La pregunta ${index + 1} no tiene opciones válidas`);
          }
          
          const respuestaCorrecta = parseInt(pregunta.respuestaCorrecta);
          if (isNaN(respuestaCorrecta) || respuestaCorrecta < 0 || respuestaCorrecta >= pregunta.opciones.length) {
            // Si la respuesta correcta no es válida, usar la primera opción como correcta
            pregunta.respuestaCorrecta = 0;
          }
        } else {
          if (!pregunta.respuestaEsperada) {
            throw new Error(`La pregunta ${index + 1} no tiene respuesta esperada`);
          }
        }

        // Asegurar que el tipo esté en la pregunta para procesamiento posterior
        pregunta.tipo = tipoPregunta;

        return pregunta;
      });

      // Si se recuperaron muy pocas preguntas, lanzar error
      if (preguntasValidadas.length < Math.ceil(numEsperadas * 0.5)) {
        throw new Error(
          `Se recuperaron solo ${preguntasValidadas.length} de ${numEsperadas} preguntas esperadas. ` +
          `Esto es insuficiente. Intenta nuevamente o aumenta max_tokens.`
        );
      }

      return preguntasValidadas;
    } catch (error) {
      this.logger.error(`Error parseando respuesta de IA: ${error.message}`);
      throw new Error(`No se pudieron generar preguntas válidas: ${error.message}`);
    }
  }

  /**
   * Intenta reparar un JSON incompleto cerrando objetos y arrays
   */
  private repairIncompleteJSON(jsonStr: string): string {
    let repaired = jsonStr.trim();
    
    // Contar llaves y corchetes
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    
    // Si el último carácter es una coma, quitarla
    if (repaired.endsWith(',')) {
      repaired = repaired.slice(0, -1);
    }
    
    // Si termina con una propiedad incompleta (ej: "explicacion": "texto sin cerrar)
    // Intentar cerrar la cadena
    if ((repaired.match(/"/g) || []).length % 2 !== 0) {
      repaired += '"';
    }
    
    // Cerrar objetos faltantes
    for (let i = 0; i < openBraces - closeBraces; i++) {
      repaired += '}';
    }
    
    // Cerrar arrays faltantes
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      repaired += ']';
    }
    
    return repaired;
  }

  /**
   * Lista todos los quizzes asociados a un tema
   */
  async listQuizzesByApunte(apunteIaId: number) {
    return await this.quizRepo.find({
      where: { apunte: { id: apunteIaId } },
      relations: ['preguntas']
    });
  }

  /**
   * Obtiene un quiz específico con sus preguntas
   */
  async findOne(id: number) {
    const quiz = await this.quizRepo.findOne({
      where: { id },
      relations: ['preguntas', 'apunte']
    });

    if (!quiz) {
      throw new NotFoundException(`Quiz con ID ${id} no encontrado`);
    }

    return quiz;
  }

  /**
   * Elimina un quiz
   */
  async remove(id: number) {
    const quiz = await this.findOne(id);
    return await this.quizRepo.remove(quiz);
  }
}
