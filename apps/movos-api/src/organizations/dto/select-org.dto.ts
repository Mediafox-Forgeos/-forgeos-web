import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SelectOrgDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  organizationId!: string;
}
