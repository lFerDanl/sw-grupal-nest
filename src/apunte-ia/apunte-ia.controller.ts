import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApunteIaService } from './apunte-ia.service';
import { CreateApunteIaDto } from './dto/create-apunte-ia.dto';
import { UpdateApunteIaDto } from './dto/update-apunte-ia.dto';

@Controller('apunte-ia')
export class ApunteIaController {
  constructor(private readonly apunteIaService: ApunteIaService) {}

  @Post(':transcriptionId/generate')
  generateApuntesFromTranscription(@Body('userId') userId: number, @Body('transcriptionId') transcriptionId: number) {
    return this.apunteIaService.generateApuntesFromTranscription(transcriptionId, userId);
  }

  @Get('user/:userId')
  listApuntesByUser(@Param('userId') userId: number) {
    return this.apunteIaService.findByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
   return this.apunteIaService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() updateApunteIaDto: UpdateApunteIaDto) {
   return this.apunteIaService.update(id, updateApunteIaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
   return this.apunteIaService.remove(id);
  }
}
