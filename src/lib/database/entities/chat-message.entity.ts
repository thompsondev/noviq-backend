import { randomUUID } from 'crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('ChatMessage')
@Index(['phoneNumber', 'createdAt'])
export class ChatMessage {
  @PrimaryColumn('text')
  id: string;

  @Column()
  phoneNumber: string;

  @Column()
  role: string;

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  private assignId() {
    this.id ??= randomUUID();
  }
}
