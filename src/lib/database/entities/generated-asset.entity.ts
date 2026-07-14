import { randomUUID } from 'crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

export type GeneratedAssetType = 'email';
export type GeneratedAssetStatus = 'completed' | 'failed';

@Entity('GeneratedAsset')
@Index(['organizationId', 'companyId'])
export class GeneratedAsset {
  @PrimaryColumn('text')
  id: string;

  @Column()
  organizationId: string;

  @Column()
  companyId: string;

  @Column()
  type: GeneratedAssetType;

  @Column()
  status: GeneratedAssetStatus;

  @Column({ type: 'text', nullable: true })
  subject: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  /** Room for future non-text asset types (image/video URLs, etc.) without a schema change. */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  private assignId() {
    this.id ??= randomUUID();
  }
}
