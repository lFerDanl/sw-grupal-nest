import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { Transcripcion } from '../../transcripcion/entities/transcripcion.entity';
import { TemaIa } from '../../tema-ia/entities/tema-ia.entity';
import { User } from 'src/users/entities/user.entity';

export enum TipoApunte {
  RESUMEN = 'resumen',
  MAPA = 'mapa',
  EXPLICACION = 'explicacion',
  FLASHCARD = 'flashcard'
}

export enum EstadoProcesamiento {
  PENDIENTE = 'pendiente',
  PROCESANDO = 'procesando',
  COMPLETADO = 'completado',
  ERROR = 'error'
}

@Entity('apunte_ia')
export class ApunteIa {
  @PrimaryGeneratedColumn({ name: 'id_apunte' })
  id: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  titulo: string;

  @Column({ type: 'text', nullable: false })
  contenido: string; // unificado para resumen, explicación o flashcards

  @Column({
    type: 'enum',
    enum: TipoApunte,
    nullable: true
  })
  tipo: TipoApunte;

  @Column({
    type: 'enum',
    enum: EstadoProcesamiento,
    default: EstadoProcesamiento.PENDIENTE
  })
  estadoIA: EstadoProcesamiento; // estado de generación de IA

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Relaciones
  @ManyToOne(() => User, user => user.apuntes, { eager:true, onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Transcripcion, transcripcion => transcripcion.id, { eager:true, onDelete: 'CASCADE' })
  transcripcion: Transcripcion;

  @OneToMany(() => TemaIa, tema => tema.apunte)
  temas: TemaIa[];
}
