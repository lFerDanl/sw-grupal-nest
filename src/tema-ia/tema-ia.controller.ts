import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TemaIaService } from './tema-ia.service';
import { CreateTemaIaDto } from './dto/create-tema-ia.dto';
import { UpdateTemaIaDto } from './dto/update-tema-ia.dto';
import { ExpandTemaDto } from './dto/expand-tema.dto';
import { AddUserSectionDto } from './dto/add-user-section.dto';
import { CreateSubtemaDto } from './dto/create-subtema.dto';

@Controller('tema-ia')
export class TemaIaController {
  constructor(private readonly temaIaService: TemaIaService) {}

  @Post(':apunteId/generate')
  generateTemaFromApunte(@Param('apunteId') noteId: number) {
    return this.temaIaService.generateTemaFromApunte(noteId);
  }

  @Get(':apunteId/apunte')
  listTemasByApunteId(@Param('apunteId') apunteId: number) {
    return this.temaIaService.listTemasByApunteId(apunteId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.temaIaService.findOne(+id);
  }

  @Post(':id/profundizar')
  expandTema(@Param('id') id: string, @Body() expandTemaDto: ExpandTemaDto) {
    return this.temaIaService.expandTema(+id, expandTemaDto.tipoExpansion);
  }

  @Post(':id/secciones')
  addUserSection(@Param('id') id: string, @Body() addUserSectionDto: AddUserSectionDto) {
    return this.temaIaService.addUserSection(+id, {
      tipoSeccion: addUserSectionDto.tipoSeccion,
      titulo: addUserSectionDto.titulo,
      contenido: addUserSectionDto.contenido
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTemaIaDto: UpdateTemaIaDto) {
    return this.temaIaService.update(+id, updateTemaIaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.temaIaService.remove(+id);
  }
}
