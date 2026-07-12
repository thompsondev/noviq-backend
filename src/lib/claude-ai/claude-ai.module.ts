import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ClaudeAiService } from './claude-ai.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [ClaudeAiService],
  exports: [ClaudeAiService],
})
export class ClaudeAiModule {}
