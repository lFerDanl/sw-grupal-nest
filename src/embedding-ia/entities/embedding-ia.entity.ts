import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { Transcripcion } from '../../transcripcion/entities/transcripcion.entity';
import { TemaIa } from '../../tema-ia/entities/tema-ia.entity';

export enum TipoContenidoEmbedding {
  RESUMEN = 'resumen',
  EXPLICACION = 'explicacion',
  FLASHCARD = 'flashcard',
  TEMA = 'tema',
  SECCION = 'seccion',
}

export enum TipoEntidadEmbedding {
  TRANSCRIPCION = 'transcripcion',
  TEMA = 'tema',
}

@Entity('embedding_ia')
export class EmbeddingIa {
  @PrimaryGeneratedColumn({ name: 'id_embedding' })
  id: number;

  @Column({ type: 'vector', nullable: true })
  vector: string;

  @Column({ type: 'enum', enum: TipoContenidoEmbedding, nullable: true })
  tipoContenido: TipoContenidoEmbedding;

  @Column({ type: 'enum', enum: TipoEntidadEmbedding, nullable: true })
  tipoEntidad: TipoEntidadEmbedding;

  @Column({ type: 'text', nullable: true })
  textoOriginal: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @ManyToOne(() => TemaIa, { onDelete: 'CASCADE', nullable: true })
  tema: TemaIa;
}
