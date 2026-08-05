import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SiteScopeQueryDto {
  @ApiPropertyOptional({
    description: 'Restrict the summary to a single site',
  })
  @IsOptional()
  @IsString()
  siteId?: string;
}
