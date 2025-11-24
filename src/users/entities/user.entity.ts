import { Role } from "src/common/enums/role.enum";
import { RespuestaUsuario } from "src/respuesta/entities/respuesta-usuario.entity";
import { SesionEstudio } from "src/sesion-estudio/entities/sesion-estudio.entity";
import { Media } from "src/media/entities/media.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, UpdateDateColumn } from "typeorm";
import { ApunteIa } from "src/apunte-ia/entities/apunte-ia.entity";

@Entity('usuarios')
export class User {
  @Column({ primary: true, generated: true })
  id: number;

  @Column({ name: 'nombre', length: 50 })
  name: string;

  @Column({ name: 'apellido', length: 50, nullable: true })
  apellido?: string;

  @Column({ name: 'correo', unique: true, nullable: false })
  email: string;

  @Column({ name: 'contrasena', nullable: false, select: false })
  password: string;

  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string;

  @Column({
    name: 'config_preferencias',
    type: 'jsonb',
    default: {}
  })
  configPreferencias: {
    idioma_predeterminado?: string;
    modo_oscuro?: boolean;
    velocidad_reproduccion?: number;
    notificaciones?: {
      email: boolean;
      push: boolean;
    };
    preferencias_estudio?: {
      resumenes_completos: boolean;
      nivel_dificultad: 'facil' | 'media' | 'dificil';
      profundizar_temas: boolean;
    };
  };

  @Column({ name: 'rol_id', type: 'int', nullable: true })
  rolId?: number;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  // Relaciones
  @OneToMany(() => Media, video => video.usuario)
  videos: Media[];

  @OneToMany(() => ApunteIa, apunte => apunte.user)
  apuntes: ApunteIa[];

  @OneToMany(() => RespuestaUsuario, respuesta => respuesta.usuario)
  respuestas: RespuestaUsuario[];

  @OneToMany(() => SesionEstudio, sesion => sesion.usuario)
  sesiones: SesionEstudio[];
}