import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@kylum.co' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'change-me-dev-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
