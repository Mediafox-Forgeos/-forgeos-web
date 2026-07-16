import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AutocompleteQueryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  input!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  sessionToken!: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;
}
