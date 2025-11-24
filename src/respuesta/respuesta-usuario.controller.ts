import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CreateRespuestaUsuarioDto } from './dto/create-respuesta-usuario.dto';
import { UpdateRespuestaUsuarioDto } from './dto/update-respuesta-usuario.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RespuestaUsuarioService } from './respuesta-usuario.service';

@ApiTags('respuestas')
@Controller('respuesta')
export class RespuestaController {
  constructor(private readonly respuestaService: RespuestaUsuarioService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar una respuesta de usuario y actualizar la sesión de estudio' })
  @ApiResponse({ 
    status: 201, 
    description: 'Respuesta registrada y sesión actualizada correctamente',
    schema: {
      properties: {
        respuesta: { type: 'object' },
        sesionActualizada: { type: 'object' }
      }
    }
  })
  respuesta(@Body() createRespuestaDto: CreateRespuestaUsuarioDto) {
    return this.respuestaService.create(createRespuestaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las respuestas de usuarios' })
  findAll() {
    return this.respuestaService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una respuesta específica por ID' })
  findOne(@Param('id') id: string) {
    return this.respuestaService.findOne(+id);
  }

  @Get('usuario/:usuarioId')
  @ApiOperation({ summary: 'Obtener todas las respuestas de un usuario específico' })
  findByUsuario(@Param('usuarioId') usuarioId: string) {
    return this.respuestaService.findByUsuario(+usuarioId);
  }

  @Get('sesion/:sesionId')
  @ApiOperation({ summary: 'Obtener todas las respuestas de una sesión de estudio' })
  findBySesion(@Param('sesionId') sesionId: string) {
    return this.respuestaService.findBySesion(+sesionId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una respuesta existente' })
  update(@Param('id') id: string, @Body() updateRespuestaDto: UpdateRespuestaUsuarioDto) {
    return this.respuestaService.update(+id, updateRespuestaDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una respuesta' })
  remove(@Param('id') id: string) {
    return this.respuestaService.remove(+id);
  }
}
