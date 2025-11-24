import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QuizIaService } from './quiz-ia.service';
import { GenerateQuizFromTemasDto } from './dto/generate-quiz-from-temas.dto';

@ApiTags('quiz-ia')
@Controller('quiz-ia')
export class QuizIaController {
  constructor(private readonly quizIaService: QuizIaService) {}

  @Post('apunte')
  @ApiOperation({ summary: 'Genera un quiz a partir de un apunte' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Quiz generado exitosamente' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Apunte o temas no encontrados' 
  })
  generateFromApunte(@Body() dto: GenerateQuizFromTemasDto) {
    console.log('DTO recibido:', dto, typeof dto.apunteId); 
    return this.quizIaService.generateQuizFromApunte(dto);
  }

  @Get('apunte/:apunteId')
  @ApiOperation({ summary: 'Lista todos los quizzes asociados a un apunte' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Lista de quizzes del tema' 
  })
  findByApunte(@Param('apunteId') apunteId: string) {
    return this.quizIaService.listQuizzesByApunte(+apunteId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un quiz específico con sus preguntas' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Quiz encontrado' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Quiz no encontrado' 
  })
  findOne(@Param('id') id: string) {
    return this.quizIaService.findOne(+id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina un quiz' })
  remove(@Param('id') id: string) {
    return this.quizIaService.remove(+id);
  }
}
