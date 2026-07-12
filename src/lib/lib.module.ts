import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { ClaudeAiModule } from './claude-ai/claude-ai.module';

@Module({
  imports: [DatabaseModule, RedisModule, ClaudeAiModule],
})
export class LibModule {}
