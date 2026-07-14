import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompanyIntelligenceAndAgentRun1771500003000 implements MigrationInterface {
  name = 'CreateCompanyIntelligenceAndAgentRun1771500003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "CompanyIntelligence" (
        "id" TEXT NOT NULL,
        "companyId" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "summary" TEXT,
        "products" JSONB NOT NULL DEFAULT '[]',
        "pricing" TEXT,
        "competitors" JSONB NOT NULL DEFAULT '[]',
        "techStack" JSONB NOT NULL DEFAULT '[]',
        "painPoints" JSONB NOT NULL DEFAULT '[]',
        "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CompanyIntelligence_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CompanyIntelligence_companyId_fkey" FOREIGN KEY ("companyId")
          REFERENCES "Company"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "CompanyIntelligence_companyId_idx"
        ON "CompanyIntelligence"("companyId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "AgentRun" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "agentType" TEXT NOT NULL,
        "contextType" TEXT NOT NULL,
        "contextId" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "input" JSONB NOT NULL,
        "output" JSONB,
        "error" TEXT,
        "retryCount" INTEGER NOT NULL DEFAULT 0,
        "startedAt" TIMESTAMP(3) NOT NULL,
        "completedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "AgentRun_organizationId_fkey" FOREIGN KEY ("organizationId")
          REFERENCES "Organization"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "AgentRun_organizationId_agentType_status_idx"
        ON "AgentRun"("organizationId", "agentType", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "AgentRun_organizationId_contextType_contextId_idx"
        ON "AgentRun"("organizationId", "contextType", "contextId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "AgentRun"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "CompanyIntelligence"`);
  }
}
