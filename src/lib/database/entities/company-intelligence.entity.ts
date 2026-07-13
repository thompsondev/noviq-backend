import { randomUUID } from 'crypto';
import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CompanyIntelligenceStatus =
  | 'completed'
  | 'insufficient_data'
  | 'failed';

@Entity('CompanyIntelligence')
export class CompanyIntelligence {
  @PrimaryColumn('text')
  id: string;

  @Index({ unique: true })
  @Column()
  companyId: string;

  @Column()
  status: CompanyIntelligenceStatus;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  products: string[];

  @Column({ type: 'text', nullable: true })
  pricing: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  competitors: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  techStack: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  painPoints: string[];

  /** Refreshes on every re-research, not just creation — drives the freshness window. */
  @UpdateDateColumn()
  generatedAt: Date;

  @BeforeInsert()
  private assignId() {
    this.id ??= randomUUID();
  }
}
