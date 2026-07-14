import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateAssetDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  companyId: string;
}
