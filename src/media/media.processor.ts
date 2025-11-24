import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media, EstadoProcesamiento } from './entities/media.entity';
import { Transcripcion } from '../transcripcion/entities/transcripcion.entity';
import { Logger } from '@nestjs/common';
import { extractAudioFFmpeg, convertToWav } from '../utils/ffmpeg.util';

@Processor('video-processing-queue')
export class VideoProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessingProcessor.name);

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(Transcripcion)
    private readonly transcripcionRepository: Repository<Transcripcion>,
    @InjectQueue('transcription-queue')
    private readonly transcriptionQueue: Queue,
  ) {
    super();
  }

  async process(job: Job) {
    const { mediaId } = job.data;
    const attemptNumber = job.attemptsMade + 1;

    this.logger.log(`🎬 Procesando media ID: ${mediaId} (intento ${attemptNumber}/${job.opts.attempts})`);
    await job.updateProgress(10);

    const media = await this.mediaRepository.findOne({
      where: { id: mediaId },
      relations: ['transcripciones'],
    });

    if (!media) {
      this.logger.error(`❌ Media no encontrada: ${mediaId}`);
      throw new Error(`Media no encontrada: ${mediaId}`);
    }

    try {
      // 🔹 Actualizar estado a procesando
      media.estadoProcesamiento = EstadoProcesamiento.PROCESANDO;
      await this.mediaRepository.save(media);
      await job.updateProgress(20);

      // 🔹 Manejo de audio/video
      let audioPath: string;
      if (media.tipo === 'VIDEO') {
        this.logger.log(`🎧 Extrayendo audio de ${media.urlArchivo}`);
        audioPath = await extractAudioFFmpeg(media.urlArchivo);
        this.logger.log(`✅ Audio extraído: ${audioPath}`);
      } else {
        audioPath = media.urlArchivo;
        this.logger.log(`📄 Archivo es audio, se usará directamente: ${audioPath}`);
      }

      // 🔹 Convertir a WAV mono 16kHz para Vosk
      const wavPath = await convertToWav(audioPath);
      this.logger.log(`✅ Audio convertido a WAV para Vosk: ${wavPath}`);
      await job.updateProgress(60);

      console.log(media.id);

      // En vez de crear transcripcion directamente:
      const transcripcion = await this.transcripcionRepository.save(
        this.transcripcionRepository.create({
          texto: '',
          idioma: 'es',
          estadoIA: EstadoProcesamiento.PENDIENTE,
          videoId: media.id,
          video: media,
        })
      );

      console.log(transcripcion.video);
      console.log(transcripcion.videoId);

      // Encolar para Vosk
      await this.transcriptionQueue.add('transcribe', {
        transcripcionId: transcripcion.id,
        audioPath: wavPath, // WAV generado en FFmpeg
      });
      await job.updateProgress(80);

      // 🔹 Marcar media como completada
      media.estadoProcesamiento = EstadoProcesamiento.COMPLETADO;
      await this.mediaRepository.save(media);
      await job.updateProgress(100);

      this.logger.log(`✅ Procesamiento completado media ID: ${media.id}`);

      return {
        mediaId: media.id,
        status: 'completed',
        audioPath: wavPath, // ruta WAV lista para Vosk
      };
    } catch (error) {
      this.logger.error(
        `❌ Error procesando media ID ${mediaId} (intento ${attemptNumber}):`,
        error.message,
      );

      // 🔹 Marcar error si es último intento
      if (attemptNumber >= (job.opts.attempts || 3)) {
        media.estadoProcesamiento = EstadoProcesamiento.ERROR;
        await this.mediaRepository.save(media);
        this.logger.error(`💥 Media ${mediaId} falló definitivamente`, error.stack);
      }

      throw error;
    }
  }
}
