// src/sesion-estudio/entities/sesion-estudio.entity.ts
import { User } from 'src/users/entities/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { QuizIa } from '../../quiz-ia/entities/quiz-ia.entity';
import { TemaIa } from '../../tema-ia/entities/tema-ia.entity';

export enum EstadoSesion {
  EN_PROGRESO = 'en_progreso',
  COMPLETADA = 'completada',
  ABANDONADA = 'abandonada'
}

@Entity('sesion_estudio')
export class SesionEstudio {
  @PrimaryGeneratedColumn({ name: 'id_sesion' })
  id: number;

  @CreateDateColumn({ name: 'fecha_inicio', type: 'timestamp' })
  fechaInicio: Date;

  @Column({ name: 'duracion_total', type: 'int', nullable: true, comment: 'en segundos' })
  duracionTotal: number;

  @Column({ 
    type: 'decimal', 
    precision: 5, 
    scale: 2, 
    default: 0,
    comment: 'Porcentaje de avance (0-100)'
  })
  progreso: number;

  @Column({ 
    name: 'resultado_evaluacion', 
    type: 'decimal', 
    precision: 5, 
    scale: 2, 
    default: 0,
    comment: 'Porcentaje de aciertos (0-100)'
  })
  resultadoEvaluacion: number;

  @Column({ 
    name: 'total_preguntas', 
    type: 'int', 
    default: 0,
    comment: 'Total de preguntas del quiz'
  })
  totalPreguntas: number;

  @Column({ 
    name: 'preguntas_respondidas', 
    type: 'int', 
    default: 0,
    comment: 'Cantidad de preguntas respondidas'
  })
  preguntasRespondidas: number;

  @Column({ 
    name: 'preguntas_correctas', 
    type: 'int', 
    default: 0,
    comment: 'Cantidad de respuestas correctas'
  })
  preguntasCorrectas: number;

  @Column({
    type: 'enum',
    enum: EstadoSesion,
    default: EstadoSesion.EN_PROGRESO,
    comment: 'Estado actual de la sesion'
  })
  estado: EstadoSesion;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Relaciones
  @ManyToOne(() => User, usuario => usuario.sesiones, { onDelete: 'CASCADE' })
  usuario: User;

  @ManyToOne(() => QuizIa, quiz => quiz.sesiones, { nullable: true, onDelete: 'SET NULL' })
  quiz: QuizIa;
}