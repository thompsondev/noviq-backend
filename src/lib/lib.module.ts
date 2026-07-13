import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { ClaudeAiModule } from './claude-ai/claude-ai.module';
import { EmailModule } from './email/email.module';
import { CompanySourceModule } from './company-source/company-source.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    ClaudeAiModule,
    EmailModule,
    CompanySourceModule,
  ],
})
export class LibModule {}
