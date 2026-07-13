import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AgentRun,
  AgentType,
} from '../../lib/database/entities/agent-run.entity';

interface StartRunInput {
  organizationId: string;
  agentType: AgentType;
  contextType: string;
  contextId: string;
  input: Record<string, unknown>;
}

@Injectable()
export class AgentRunsService {
  constructor(
    @InjectRepository(AgentRun) private readonly repo: Repository<AgentRun>,
  ) {}

  async start(params: StartRunInput): Promise<AgentRun> {
    return this.repo.save(
      this.repo.create({
        organizationId: params.organizationId,
        agentType: params.agentType,
        contextType: params.contextType,
        contextId: params.contextId,
        status: 'running',
        input: params.input,
        output: null,
        error: null,
        retryCount: 0,
        startedAt: new Date(),
        completedAt: null,
      }),
    );
  }

  async complete(
    run: AgentRun,
    output: Record<string, unknown>,
  ): Promise<AgentRun> {
    run.status = 'completed';
    run.output = output;
    run.completedAt = new Date();
    return this.repo.save(run);
  }

  async fail(
    run: AgentRun,
    error: string,
    retryCount: number,
  ): Promise<AgentRun> {
    run.status = 'failed';
    run.error = error;
    run.retryCount = retryCount;
    run.completedAt = new Date();
    return this.repo.save(run);
  }

  async list(organizationId: string): Promise<AgentRun[]> {
    return this.repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(organizationId: string, id: string): Promise<AgentRun | null> {
    return this.repo.findOne({ where: { organizationId, id } });
  }
}
