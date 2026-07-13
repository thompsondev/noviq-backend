import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompany1771500002000 implements MigrationInterface {
  name = 'CreateCompany1771500002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "Company" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "domain" TEXT NOT NULL,
        "industry" TEXT,
        "country" TEXT,
        "employeeCount" INTEGER,
        "revenue" TEXT,
        "technologies" JSONB NOT NULL DEFAULT '[]',
        "fundingStage" TEXT,
        "sourceQuery" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Company_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId")
          REFERENCES "Organization"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Company_organizationId_domain_idx"
        ON "Company"("organizationId", "domain")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "Company_organizationId_industry_idx"
        ON "Company"("organizationId", "industry")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "Company_organizationId_country_idx"
        ON "Company"("organizationId", "country")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "Company"`);
  }
}
