import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AiModule } from './ai/ai.module';
import { WhatsappModule } from './whatsapp/wa.module';
import { RedisModule } from './redis/redis.module';
import { SlackModule } from './slack/slack.module';
import { ClaudeAiModule } from './claude-ai/claude-ai.module';

@Module({
  imports: [
    DatabaseModule,
    AiModule,
    WhatsappModule,
    RedisModule,
    SlackModule,
    ClaudeAiModule,
  ],
})
export class LibModule {}
