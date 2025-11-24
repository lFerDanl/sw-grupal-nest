import { PartialType } from '@nestjs/mapped-types';
import { CreateApunteIaDto } from './create-apunte-ia.dto';

export class UpdateApunteIaDto extends PartialType(CreateApunteIaDto) {}
