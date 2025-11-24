import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { PreguntaIa } from '../../pregunta-ia/entities/pregunta-ia.entity';
import { User } from '../../users/entities/user.entity';
import { SesionEstudio } from '../../sesion-estudio/entities/sesion-estudio.entity';

@Entity('respuesta_usuario')
export class RespuestaUsuario {
  @PrimaryGeneratedColumn({ name: 'id_respuesta' })
  id: number;

  @Column({ name: 'respuesta_usuario', type: 'text', nullable: true })
  respuestaUsuario: string;

  @Column({ type: 'boolean', nullable: true })
  correcta: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  puntuacion: number;

  @CreateDateColumn()
  createdAt: Date; // se usa creado en vez de fecha_respuesta duplicada

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Relaciones
  @ManyToOne(() => PreguntaIa, pregunta => pregunta.respuestas, { onDelete: 'CASCADE' })
  pregunta: PreguntaIa;

  @ManyToOne(() => User, usuario => usuario.respuestas, { onDelete: 'CASCADE' })
  usuario: User;

  @ManyToOne(() => SesionEstudio, { onDelete: 'CASCADE' })
  sesion: SesionEstudio;
}
