// src/tema-ia/entities/tema-ia.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { ApunteIa } from '../../apunte-ia/entities/apunte-ia.entity';
import { SesionEstudio } from 'src/sesion-estudio/entities/sesion-estudio.entity';

// Interfaces para el contenido estructurado
export interface SeccionTema {
  id: string;
  tipoSeccion: 'introduccion' | 'concepto' | 'ejemplo' | 'ejercicio' | 'aplicacion' | 'conclusion' | 'referencia';
  titulo: string;
  contenido: string;
  orden: number;
  nivelProfundidad: number;
  origen: 'ia' | 'usuario';
  createdAt: string;
}

export interface EstructuraTema {
  secciones: SeccionTema[];
  version: number;
  lastUpdated: string;
}

@Entity('tema_ia')
export class TemaIa {
  @PrimaryGeneratedColumn({ name: 'id_tema' })
  id: number;

  @Column({ name: 'titulo_tema', type: 'varchar', length: 200, nullable: false })
  tituloTema: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'text', nullable: true })
  contenido: string;

  @Column({
    name: 'estructura',
    type: 'jsonb',
    nullable: true,
    comment: 'Estructura del tema con secciones organizadas'
  })
  estructura: EstructuraTema;

  @Column({
    name: 'nivel_profundidad',
    type: 'smallint',
    default: 1,
    comment: 'Nivel de profundidad del tema (1=básico, 2=intermedio, 3=avanzado)'
  })
  nivelProfundidad: number;

  @Column({
    type: 'enum',
    enum: ['ia', 'usuario', 'mixto'],
    default: 'ia',
    comment: 'Origen del contenido del tema'
  })
  origen: 'ia' | 'usuario' | 'mixto';

  @Column({
    type: 'smallint',
    default: 0,
    comment: 'Orden del tema dentro del apunte'
  })
  orden: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Relaciones jerárquicas
  @ManyToOne(() => TemaIa, tema => tema.subtemas, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_tema_padre' })
  parentTema: TemaIa;

  @OneToMany(() => TemaIa, tema => tema.parentTema)
  subtemas: TemaIa[];

  // Relaciones existentes
  @ManyToOne(() => ApunteIa, apunte => apunte.temas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_apunte' })
  apunte: ApunteIa;

  
}