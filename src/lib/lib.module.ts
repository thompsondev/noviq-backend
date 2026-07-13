import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { ClaudeAiModule } from './claude-ai/claude-ai.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [DatabaseModule, RedisModule, ClaudeAiModule, EmailModule],
})
export class LibModule {}
