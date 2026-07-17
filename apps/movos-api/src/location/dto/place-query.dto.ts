import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class PlaceQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  sessionToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;
}
