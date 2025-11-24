import {Controller,Get,Post,Body,Patch,Param,Delete,UseInterceptors,UploadedFile,BadRequestException,} from '@nestjs/common';
import { MediaService } from './media.service';
import { ActiveUserInterface } from 'src/common/interfaces/active-user.interface';
import { ActiveUser } from 'src/common/decorator/active-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadMediaDto } from './dto/upload-media.dto';
import { EstadoProcesamiento } from './entities/media.entity';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/media',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
    }),
  )
  async uploadMedia(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadMediaDto: UploadMediaDto,
  ) {
    if (!file) throw new BadRequestException('Debe subir un archivo');
    if (!['VIDEO', 'AUDIO'].includes(uploadMediaDto.tipo))
      throw new BadRequestException('Tipo inválido: debe ser VIDEO o AUDIO');

    const media = await this.mediaService.crearYProcesar({
      ...uploadMediaDto,
      urlArchivo: file.path,
      estadoProcesamiento: EstadoProcesamiento.PENDIENTE,
    });

    return {
      message: '✅ Archivo subido correctamente y encolado para procesamiento',
      media,
    };
  }

  @Get('user')
  findByUser(@ActiveUser() user: ActiveUserInterface) {
    return this.mediaService.findByUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.mediaService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.mediaService.remove(id);
  }

  @Post(':id/reprocess')
  reprocess(@Param('id') id: number) {
    return this.mediaService.reprocess(id);
  }
}
