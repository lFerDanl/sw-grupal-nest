// src/quiz-ia/entities/quiz-ia.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { ApunteIa } from '../../apunte-ia/entities/apunte-ia.entity';
import { PreguntaIa } from '../../pregunta-ia/entities/pregunta-ia.entity';
import { SesionEstudio } from 'src/sesion-estudio/entities/sesion-estudio.entity';

export enum TipoQuiz {
  MULTIPLE = 'multiple',
  ABIERTA = 'abierta',
  MIXTO = 'mixto'
}

export enum Dificultad {
  FACIL = 'facil',
  MEDIA = 'media',
  DIFICIL = 'dificil'
}

@Entity('quiz_ia')
export class QuizIa {
  @PrimaryGeneratedColumn({ name: 'id_quiz' })
  id: number;

  @Column({
    type: 'enum',
    enum: TipoQuiz,
    default: TipoQuiz.MULTIPLE
  })
  tipo: TipoQuiz;

  @Column({
    type: 'enum',
    enum: Dificultad,
    default: Dificultad.MEDIA
  })
  dificultad: Dificultad;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Relaciones
  @ManyToOne(() => ApunteIa, apunte => apunte.temas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_apunte' })
  apunte: ApunteIa;

  @OneToMany(() => PreguntaIa, pregunta => pregunta.quiz)
  preguntas: PreguntaIa[];
  
  @OneToMany(() => SesionEstudio, sesion => sesion.quiz)
  sesiones: SesionEstudio[];
}