import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGeneratedAsset1771500004000 implements MigrationInterface {
  name = 'CreateGeneratedAsset1771500004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "GeneratedAsset" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "companyId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "subject" TEXT,
        "body" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GeneratedAsset_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "GeneratedAsset_organizationId_fkey" FOREIGN KEY ("organizationId")
          REFERENCES "Organization"("id") ON DELETE CASCADE,
        CONSTRAINT "GeneratedAsset_companyId_fkey" FOREIGN KEY ("companyId")
          REFERENCES "Company"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "GeneratedAsset_organizationId_companyId_idx"
        ON "GeneratedAsset"("organizationId", "companyId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "GeneratedAsset"`);
  }
}
