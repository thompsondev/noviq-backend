import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizationAndUser1771500001000 implements MigrationInterface {
  name = 'CreateOrganizationAndUser1771500001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "Organization" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_idx"
        ON "Organization"("slug")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'owner',
        "emailVerifiedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId")
          REFERENCES "Organization"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "User_email_idx"
        ON "User"("email")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "User_organizationId_idx"
        ON "User"("organizationId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "User"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "Organization"`);
  }
}
