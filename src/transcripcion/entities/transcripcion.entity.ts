import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
  DeleteDateColumn,
  JoinColumn,
} from 'typeorm';
import { Media } from '../../media/entities/media.entity';
import { ApunteIa } from '../../apunte-ia/entities/apunte-ia.entity';
import { EmbeddingIa } from '../../embedding-ia/entities/embedding-ia.entity';

export enum EstadoProcesamiento {
  PENDIENTE = 'pendiente',
  PROCESANDO = 'procesando',
  COMPLETADO = 'completado',
  ERROR = 'error',
}

@Entity('transcripcion')
export class Transcripcion {
  @PrimaryGeneratedColumn({ name: 'id_transcripcion' })
  id: number;

  @Column({ type: 'text', nullable: true })
  texto: string; // puede empezar vacío

  @Column({ type: 'varchar', length: 10, default: 'es' })
  idioma: string;

  @Column({ name: 'duracion_segundos', type: 'int', nullable: true })
  duracionSegundos: number;

  @Column({
    name: 'estado_ia',
    type: 'enum',
    enum: EstadoProcesamiento,
    default: EstadoProcesamiento.PENDIENTE,
  })
  estadoIA: EstadoProcesamiento;

  @Column({ name: 'videoId', type: 'int', nullable: true })
  videoId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @ManyToOne(() => Media, (video) => video.transcripciones, { eager:true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'videoId' })
  video: Media;

  @OneToMany(() => ApunteIa, (apunte) => apunte.transcripcion)
  apuntes: ApunteIa[];
}
