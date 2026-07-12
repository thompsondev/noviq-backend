import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AiService } from './ai.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
