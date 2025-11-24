import { PartialType } from '@nestjs/mapped-types';
import { CreateTemaIaDto } from './create-tema-ia.dto';

export class UpdateTemaIaDto extends PartialType(CreateTemaIaDto) {}
