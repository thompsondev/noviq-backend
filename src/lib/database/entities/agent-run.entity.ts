import { randomUUID } from 'crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

export type AgentType = 'research' | 'content';
export type AgentRunStatus = 'running' | 'completed' | 'failed';

@Entity('AgentRun')
@Index(['organizationId', 'agentType', 'status'])
@Index(['organizationId', 'contextType', 'contextId'])
export class AgentRun {
  @PrimaryColumn('text')
  id: string;

  @Column()
  organizationId: string;

  @Column()
  agentType: AgentType;

  /** What triggered this run, e.g. contextType "company" + contextId the Company id. */
  @Column()
  contextType: string;

  @Column()
  contextId: string;

  @Column()
  status: AgentRunStatus;

  @Column({ type: 'jsonb' })
  input: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  output: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  private assignId() {
    this.id ??= randomUUID();
  }
}
