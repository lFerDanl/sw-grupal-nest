import { forwardRef, Module } from '@nestjs/common';
import { TemaIaService } from './tema-ia.service';
import { TemaIaController } from './tema-ia.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemaIa } from './entities/tema-ia.entity';
import { ApunteIa } from 'src/apunte-ia/entities/apunte-ia.entity';
import { ApunteIaModule } from 'src/apunte-ia/apunte-ia.module';
import { IAModule } from 'src/ia/ia.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TemaIa]),
    forwardRef(() => ApunteIaModule),
    IAModule,
  ],
  controllers: [TemaIaController],
  providers: [TemaIaService],
  exports: [TypeOrmModule,TemaIaService],
})
export class TemaIaModule {}
