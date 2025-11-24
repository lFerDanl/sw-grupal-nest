import { Injectable, Logger } from '@nestjs/common';
import { UploadMediaDto } from './dto/upload-media.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { EstadoProcesamiento, Media } from './entities/media.entity';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { MediaProducer } from './media.producer';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly mediaProducer: MediaProducer,
  ) {}

  async crearYProcesar(data: UploadMediaDto & { urlArchivo: string }) {
    const idUsuario = parseInt(data.idUsuario);
    const usuario = await this.userRepo.findOne({ where: { id: idUsuario } });
    if (!usuario) throw new Error('Usuario no encontrado');
  
    const media = this.mediaRepo.create({
      titulo: data.titulo,
      descripcion: data.descripcion,
      tipo: data.tipo,
      urlArchivo: data.urlArchivo,
      estadoProcesamiento: data.estadoProcesamiento ?? EstadoProcesamiento.PENDIENTE,
      usuario,
    });
  
    const saved = await this.mediaRepo.save(media);
  
    await this.mediaProducer.enqueue(saved.id);
  
    this.logger.log(`📤 Media encolada: ${saved.id}`);
    return saved;
  }

  async findByUser(userId: number) {
    return this.mediaRepo.find({
      where: { usuario: { id: userId } },
      relations: ['transcripciones'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    return this.mediaRepo.findOne({
      where: { id },
      relations: ['transcripciones', 'usuario'],
    });
  }

  async remove(id: number) {
    const media = await this.findOne(id);
    if (!media) throw new Error('Media no encontrada');
    await this.mediaRepo.softDelete(id);
    return { message: 'Media eliminada correctamente' };
  }

  async reprocess(id: number) {
    const media = await this.findOne(id);
    if (!media) throw new Error('Media no encontrada');

    media.estadoProcesamiento = EstadoProcesamiento.PENDIENTE;
    await this.mediaRepo.save(media);

    await this.mediaProducer.enqueue(id);
    this.logger.log(`🔄 Media reenviada a la cola: ${id}`);

    return { message: 'Media reenviada a la cola', id };
  }
}