import { randomUUID } from 'crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

export type UserRole = 'owner' | 'member';

@Entity('User')
@Index(['organizationId'])
export class User {
  @PrimaryColumn('text')
  id: string;

  @Column()
  organizationId: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @Column({ default: 'owner' })
  role: UserRole;

  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  private assignId() {
    this.id ??= randomUUID();
  }
}
