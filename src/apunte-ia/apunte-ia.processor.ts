import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ApunteIaService } from './apunte-ia.service';
import { TemaIaService } from 'src/tema-ia/tema-ia.service';
import { TipoApunte } from './entities/apunte-ia.entity';

/**
 * 📝 Processor simplificado que delega toda la lógica al servicio
 * El servicio ahora maneja el guardado incremental
 */

@Processor('apuntes-queue')
export class ApuntesProcessor extends WorkerHost {
  private readonly logger = new Logger(ApuntesProcessor.name);
  

  constructor(
    private readonly apunteIaService: ApunteIaService,
    private readonly temaIaService: TemaIaService,
  ) {
    super();
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async process(job: Job) {
    const { transcripcionId, userId } = job.data;

    this.logger.log(`🔄 Procesando job para transcripción ${transcripcionId}`);

    try {
      // 🎯 Usar generación incremental (guarda cada apunte al generarlo)
      const apuntesGuardados = await this.apunteIaService.generateApuntesIncremental(
        transcripcionId,
        userId
      );
      
      // 🔗 Generar temas para apuntes clave (EXPLICACION)
      const candidatos = apuntesGuardados.filter(a => 
        a.tipo === TipoApunte.RESUMEN
      );
      /*
      await this.sleep(60_000);

      let temasTotal = 0;
      for (const apunte of candidatos) {
        try {
          const temas = await this.temaIaService.generateTemaFromApunte(apunte.id);
          temasTotal += temas.length;
          this.logger.log(`📚 Temas generados para apunte ${apunte.id}: ${temas.length}`);
        } catch (err) {
          this.logger.warn(`⚠️ No se pudieron generar temas para apunte ${apunte.id}: ${err.message}`);
        }
      }

      this.logger.log(
        `✅ Proceso completado para transcripción ${transcripcionId}. ` +
        `Total apuntes: ${apuntesGuardados.length}, temas generados: ${temasTotal}`
      );*/

      return {
        transcripcionId,
        status: 'completed',
        apuntesTotal: apuntesGuardados.length,
        apuntesIds: apuntesGuardados.map(a => a.id),
        temasGenerados: candidatos.length,
      };

    } catch (error) {
      this.logger.error(
        `❌ Error crítico en transcripción ${transcripcionId}`,
        error.stack
      );

      throw error;
    }
  }
}