import {IsOptional,IsString,IsBoolean,IsNumber,IsObject,ValidateNested,IsIn,} from 'class-validator';
import { Type } from 'class-transformer';
  
// 1. DTO para Notificaciones
export class NotificacionesDto {
    @IsBoolean()
    @IsOptional()
    email?: boolean;

    @IsBoolean()
    @IsOptional()
    push?: boolean;
}

// 2. DTO para Preferencias de Estudio
export class PreferenciasEstudioDto {
    @IsBoolean()
    @IsOptional()
    resumenes_completos?: boolean;

    // Usa IsIn para validar que el valor sea uno de los permitidos
    @IsIn(['facil', 'media', 'dificil'])
    @IsOptional()
    nivel_dificultad?: 'facil' | 'media' | 'dificil';

    @IsBoolean()
    @IsOptional()
    profundizar_temas?: boolean;
}

// 3. DTO para ConfigPreferencias
export class ConfigPreferenciasDto {
    @IsString()
    @IsOptional()
    idioma_predeterminado?: string;

    @IsBoolean()
    @IsOptional()
    modo_oscuro?: boolean;

    @IsNumber()
    @IsOptional()
    velocidad_reproduccion?: number;

    @IsObject()
    @IsOptional()
    @ValidateNested() // Importante para validar el contenido del objeto anidado
    @Type(() => NotificacionesDto) // Importante para que class-transformer sepa qué clase instanciar
    notificaciones?: NotificacionesDto;

    @IsObject()
    @IsOptional()
    @ValidateNested()
    @Type(() => PreferenciasEstudioDto)
    preferencias_estudio?: PreferenciasEstudioDto;
}

// 4. DTO Principal de Actualización
export class UpdatePreguntaIaDto {
    @IsObject()
    @IsOptional() // El objeto completo es opcional
    @ValidateNested() // Importante para validar el contenido del objeto anidado
    @Type(() => ConfigPreferenciasDto) // Importante para que class-transformer sepa qué clase instanciar
    configPreferencias?: ConfigPreferenciasDto;
}