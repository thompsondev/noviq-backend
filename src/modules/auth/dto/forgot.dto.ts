import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}
