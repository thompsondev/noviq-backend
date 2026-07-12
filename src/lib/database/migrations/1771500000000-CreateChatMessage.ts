import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatMessage1771500000000 implements MigrationInterface {
  name = 'CreateChatMessage1771500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS guards so this is a no-op on databases that already have
    // the table from the previous Prisma migration.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ChatMessage" (
        "id" TEXT NOT NULL,
        "phoneNumber" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ChatMessage_phoneNumber_createdAt_idx"
        ON "ChatMessage"("phoneNumber", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ChatMessage"`);
  }
}
