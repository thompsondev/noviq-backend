import { randomUUID } from 'crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('Company')
@Index(['organizationId', 'domain'], { unique: true })
@Index(['organizationId', 'industry'])
@Index(['organizationId', 'country'])
export class Company {
  @PrimaryColumn('text')
  id: string;

  @Column()
  organizationId: string;

  @Column()
  name: string;

  @Column()
  domain: string;

  @Column({ type: 'text', nullable: true })
  industry: string | null;

  @Column({ type: 'text', nullable: true })
  country: string | null;

  @Column({ type: 'int', nullable: true })
  employeeCount: number | null;

  @Column({ type: 'text', nullable: true })
  revenue: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  technologies: string[];

  @Column({ type: 'text', nullable: true })
  fundingStage: string | null;

  @Column({ type: 'text', nullable: true })
  sourceQuery: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  private assignId() {
    this.id ??= randomUUID();
  }
}
