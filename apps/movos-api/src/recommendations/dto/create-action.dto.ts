import { ApiProperty } from '@nestjs/swagger';
import { RecommendationType } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

import { TransitionActionDto } from './transition-action.dto';

export class CreateActionDto extends TransitionActionDto {
  @ApiProperty({ enum: RecommendationType })
  @IsEnum(RecommendationType)
  recommendationType!: RecommendationType;

  @ApiProperty()
  @IsString()
  stationId!: string;
}
