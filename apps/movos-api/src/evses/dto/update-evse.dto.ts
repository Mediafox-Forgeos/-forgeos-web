import { PartialType } from '@nestjs/swagger';

import { CreateEvseDto } from './create-evse.dto';

export class UpdateEvseDto extends PartialType(CreateEvseDto) {}
