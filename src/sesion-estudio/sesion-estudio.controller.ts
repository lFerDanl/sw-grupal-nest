import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SesionEstudioService } from './sesion-estudio.service';
import { CreateSesionEstudioDto } from './dto/create-sesion-estudio.dto';
import { UpdateSesionEstudioDto } from './dto/update-sesion-estudio.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('sesion-estudio')
@Controller('sesion-estudio')
export class SesionEstudioController {
  constructor(private readonly sesionEstudioService: SesionEstudioService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva sesión de estudio' })
  @ApiResponse({ status: 201, description: 'Sesión creada correctamente' })
  create(@Body() createSesionEstudioDto: CreateSesionEstudioDto) {
    return this.sesionEstudioService.create(createSesionEstudioDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las sesiones de estudio' })
  findAll() {
    return this.sesionEstudioService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una sesión de estudio por ID' })
  findOne(@Param('id') id: string) {
    return this.sesionEstudioService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una sesión de estudio' })
  update(@Param('id') id: string, @Body() updateSesionEstudioDto: UpdateSesionEstudioDto) {
    return this.sesionEstudioService.update(+id, updateSesionEstudioDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una sesión de estudio' })
  remove(@Param('id') id: string) {
    return this.sesionEstudioService.remove(+id);
  }

  @Get('recomendaciones/:usuarioId')
  @ApiOperation({ summary: 'Obtener recomendaciones personalizadas para un usuario' })
  @ApiResponse({ 
    status: 200, 
    description: 'Recomendaciones obtenidas correctamente',
    schema: {
      properties: {
        recomendaciones: {
          type: 'array',
          items: {
            properties: {
              temaId: { type: 'number' },
              titulo: { type: 'string' },
              descripcion: { type: 'string' },
              similitud: { type: 'number' }
            }
          }
        }
      }
    }
  })
  getRecomendaciones(@Param('usuarioId') usuarioId: string) {
    return this.sesionEstudioService.getRecomendaciones(+usuarioId);
  }

  @Get('recomendaciones/:usuarioId/quiz/:quizId')
  @ApiOperation({ summary: 'Obtener recomendaciones para un usuario enfocadas en un quiz' })
  @ApiResponse({ status: 200, description: 'Recomendaciones por quiz obtenidas correctamente' })
  getRecomendacionesPorQuiz(
    @Param('usuarioId') usuarioId: string,
    @Param('quizId') quizId: string,
  ) {
    return this.sesionEstudioService.getRecomendacionesPorQuiz(+usuarioId, +quizId);
  }
}
