// src/pregunta-ia/entities/pregunta-ia.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { QuizIa } from '../../quiz-ia/entities/quiz-ia.entity';
import { RespuestaUsuario } from 'src/respuesta/entities/respuesta-usuario.entity';

export enum TipoPregunta {
  OPCION_MULTIPLE = 'opcion_multiple',
  ABIERTA = 'abierta'
}

@Entity('pregunta_ia')
export class PreguntaIa {
  @PrimaryGeneratedColumn({ name: 'id_pregunta' })
  id: number;

  @Column({ type: 'text', nullable: false })
  enunciado: string;

  @Column({
    type: 'enum',
    enum: TipoPregunta,
    default: TipoPregunta.OPCION_MULTIPLE
  })
  tipo: TipoPregunta;

  @Column({ name: 'respuesta_correcta', type: 'integer', nullable: true })
  respuestaCorrecta: number;

  @Column({ name: 'respuesta_esperada', type: 'text', nullable: true })
  respuestaEsperada: string;

  @Column({ type: 'jsonb', nullable: true })
  opciones: string[];

  @Column({ type: 'text', nullable: true })
  explicacion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Relaciones
  @ManyToOne(() => QuizIa, quiz => quiz.preguntas, { onDelete: 'CASCADE' })
  quiz: QuizIa;

  @OneToMany(() => RespuestaUsuario, respuesta => respuesta.pregunta)
  respuestas: RespuestaUsuario[];
}