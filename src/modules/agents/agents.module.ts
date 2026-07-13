import { Module } from '@nestjs/common';
import { AgentRunsService } from './agent-runs.service';
import { AgentRunsController } from './agent-runs.controller';
import { ResearchAgentService } from './research-agent.service';

@Module({
  controllers: [AgentRunsController],
  providers: [AgentRunsService, ResearchAgentService],
  exports: [AgentRunsService, ResearchAgentService],
})
export class AgentsModule {}
