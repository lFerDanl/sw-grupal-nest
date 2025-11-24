import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Transcripcion, EstadoProcesamiento } from './entities/transcripcion.entity';
import { Logger } from '@nestjs/common';
const { transcribeWithVosk } = require('../utils/vosk-helper');

@Processor('transcription-queue')
export class TranscriptionProcessor extends WorkerHost {
  private readonly logger = new Logger(TranscriptionProcessor.name);

  constructor(
    @InjectRepository(Transcripcion)
    private readonly transcripcionRepo: Repository<Transcripcion>,

    // 🔹 Nueva cola: apuntes
    @InjectQueue('apuntes-queue')
    private readonly apuntesQueue: Queue,
  ) {
    super();
  }

  async process(job: Job) {
    const { transcripcionId, audioPath } = job.data;
    const transcripcion = await this.transcripcionRepo.findOne({ where: { id: transcripcionId } });

    console.log(transcripcion);
    if (!transcripcion) {
      this.logger.error(`❌ Transcripción no encontrada: ${transcripcionId}`);
      throw new Error(`Transcripción no encontrada: ${transcripcionId}`);
    }

    try {
      this.logger.log(`🎤 Procesando transcripción ID: ${transcripcionId}`);
      transcripcion.estadoIA = EstadoProcesamiento.PROCESANDO;
      await this.transcripcionRepo.save(transcripcion);

      const texto = await transcribeWithVosk(audioPath);
      transcripcion.texto = texto;

      if (!transcripcion.duracionSegundos) {
        transcripcion.duracionSegundos = Math.max(1, Math.floor(texto.split(' ').length * 0.5));
      }

      transcripcion.estadoIA = EstadoProcesamiento.COMPLETADO;
      await this.transcripcionRepo.save(transcripcion);

      // 🔹 Encolar siguiente flujo: generación de apuntes
      await this.apuntesQueue.add('generate-apuntes', { transcripcionId });
      this.logger.log(`📤 Job encolado en apuntes-queue para transcripción ${transcripcionId}`);

      return { transcripcionId, status: 'completed' };
    } catch (error) {
      this.logger.error(`❌ Error en transcripción ID: ${transcripcionId}`, error.stack);
      transcripcion.estadoIA = EstadoProcesamiento.ERROR;
      await this.transcripcionRepo.save(transcripcion);
      throw error;
    }
  }
}
