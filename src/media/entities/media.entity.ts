import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Transcripcion } from "../../transcripcion/entities/transcripcion.entity";
import { User } from "../../users/entities/user.entity";

export enum EstadoProcesamiento {
  PENDIENTE = 'pendiente',
  PROCESANDO = 'procesando',
  COMPLETADO = 'completado',
  ERROR = 'error',
}

@Entity('media')
export class Media {
  @PrimaryGeneratedColumn({ name: 'id_media' })
  id: number;

  @Column({ type: 'varchar', length: 200, nullable: false })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'enum', enum: ['VIDEO', 'AUDIO'] })
  tipo: 'VIDEO' | 'AUDIO';

  @Column({ name: 'url_archivo', type: 'text', nullable: false })
  urlArchivo: string; // ruta local (por ejemplo: uploads/media/uuid.mp4)

  @Column({ name: 'ruta_audio', type: 'text', nullable: true })
  rutaAudio: string; // se llena cuando se extrae el audio del video

  @Column({
    name: 'estado_procesamiento',
    type: 'enum',
    enum: EstadoProcesamiento,
    default: EstadoProcesamiento.PENDIENTE,
  })
  estadoProcesamiento: EstadoProcesamiento;

  @Column({ name: 'duracion_segundos', type: 'int', nullable: true })
  duracionSegundos: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Relaciones
  @ManyToOne(() => User, (usuario) => usuario.id, { eager:true, onDelete: 'CASCADE' })
  usuario: User;

  @OneToMany(() => Transcripcion, (transcripcion) => transcripcion.video)
  transcripciones: Transcripcion[];
}
