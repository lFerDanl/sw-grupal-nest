import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Transcripcion, EstadoProcesamiento } from './entities/transcripcion.entity';
import { Media } from '../media/entities/media.entity';

@Injectable()
export class TranscripcionService {
  private readonly logger = new Logger(TranscripcionService.name);

  constructor(
    @InjectRepository(Transcripcion)
    private readonly transcripcionRepo: Repository<Transcripcion>,

    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,

    @InjectQueue('transcription-queue')
    private readonly transcriptionQueue: Queue,
  ) {}

  /**
   * Obtiene todas las transcripciones de un video.
   */
  async findByVideo(videoId: number) {
    const video = await this.mediaRepo.findOne({
      where: { id: videoId },
      relations: ['transcripciones'],
    });

    if (!video) throw new NotFoundException(`Video no encontrado (ID ${videoId})`);
    return video.transcripciones;
  }

  /**
   * Guarda o actualiza el texto procesado (usado internamente o por IA).
   */
  async saveTranscription(videoId: number, texto: string) {
    const video = await this.mediaRepo.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException(`Video no encontrado (ID ${videoId})`);

    const transcripcion = this.transcripcionRepo.create({
      texto,
      estadoIA: EstadoProcesamiento.COMPLETADO,
      idioma: 'es',
      videoId: video.id,
      video,
    });

    return await this.transcripcionRepo.save(transcripcion);
  }

  /**
   * Reprocesa una transcripción desde el archivo WAV del video.
   * Reencola el job en transcription-queue.
   */
  async reprocesar(id: number) {
    const transcripcion = await this.transcripcionRepo.findOne({
      where: { id },
      relations: ['video'],
    });

    if (!transcripcion) throw new NotFoundException(`Transcripción no encontrada (ID ${id})`);
    if (!transcripcion.video?.urlArchivo) {
      throw new Error(`El video asociado no tiene un archivo válido.`);
    }

    this.logger.log(`♻️ Reprocesando transcripción ID ${id} (media: ${transcripcion.video.id})`);

    // Actualizar estado
    transcripcion.estadoIA = EstadoProcesamiento.PROCESANDO;
    transcripcion.texto = '';
    await this.transcripcionRepo.save(transcripcion);

    // Encolar nuevamente
    await this.transcriptionQueue.add('transcribe', {
      transcripcionId: transcripcion.id,
      audioPath: transcripcion.video.urlArchivo, // asumimos que es un WAV válido
    });

    return { message: `Transcripción ${id} encolada para reprocesar.` };
  }
}
