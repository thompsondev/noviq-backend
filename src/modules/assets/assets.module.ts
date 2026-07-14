import { Module } from '@nestjs/common';
import { EmailGenerationService } from './email-generation.service';
import { AssetsController } from './assets.controller';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule],
  controllers: [AssetsController],
  providers: [EmailGenerationService],
})
export class AssetsModule {}
