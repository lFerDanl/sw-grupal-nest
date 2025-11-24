import { Controller, Get, Patch, Param, Body, Post } from '@nestjs/common';
import { TranscripcionService } from './transcripcion.service';

@Controller('transcripciones')
export class TranscripcionController {
  constructor(private readonly transcripcionService: TranscripcionService) {}

  @Get('video/:videoId')
  findByVideo(@Param('videoId') videoId: number) {
    return this.transcripcionService.findByVideo(videoId);
  }

  @Post(':id/reprocesar')
  reprocesar(@Param('id') id: number) {
    return this.transcripcionService.reprocesar(id);
  }
}
