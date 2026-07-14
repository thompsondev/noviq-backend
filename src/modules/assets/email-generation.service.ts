import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClaudeAiService } from '../../lib/claude-ai/claude-ai.service';
import { extractJsonObject } from '../../lib/claude-ai/extract-json';
import { Company } from '../../lib/database/entities/company.entity';
import { CompanyIntelligence } from '../../lib/database/entities/company-intelligence.entity';
import { GeneratedAsset } from '../../lib/database/entities/generated-asset.entity';
import { AgentRunsService } from '../agents/agent-runs.service';

const MAX_ATTEMPTS = 2;

const SYSTEM_PROMPT = `You are a marketing copywriter for Noviq, an AI platform that helps B2B teams find, research, and reach out to companies. You write short, personalized cold outreach emails grounded in real research about the recipient — never generic filler, never invented details. Friendly, credible, not salesy.`;

function buildPrompt(company: Company, intel: CompanyIntelligence): string {
  const findings = [
    intel.summary ? `Summary: ${intel.summary}` : null,
    intel.products.length ? `Products: ${intel.products.join(', ')}` : null,
    intel.pricing ? `Pricing: ${intel.pricing}` : null,
    intel.competitors.length
      ? `Competitors named on their site: ${intel.competitors.join(', ')}`
      : null,
    intel.techStack.length
      ? `Tech stack detected: ${intel.techStack.join(', ')}`
      : null,
    intel.painPoints.length
      ? `Pain points their site addresses: ${intel.painPoints.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `Write a short, personalized cold outreach email to ${company.name} (${company.domain}), introducing Noviq.

Research findings about them:
${findings}

Reference at least one specific detail from the findings above so this clearly isn't a generic template. Keep it under 150 words, friendly and professional, no excessive hype or exclamation points.

Respond with ONLY a JSON object (no commentary before or after) shaped exactly like:
{"subject": "short subject line", "body": "the full email body as plain text, using \\n for line breaks"}

Respond with the JSON object and nothing else.`;
}

interface ParsedEmail {
  subject: string;
  body: string;
}

function parseEmail(raw: string): ParsedEmail {
  const jsonText = extractJsonObject(raw.trim());
  const parsed: unknown = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Expected a JSON object');
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.subject !== 'string' || typeof record.body !== 'string') {
    throw new Error('Response missing subject or body');
  }
  return { subject: record.subject, body: record.body };
}

/**
 * The Content Agent's first job (see docs/05-ai-agent-system.md): generate
 * personalized email copy from a company's existing research. No web tools
 * needed here — it's synthesis over data already fetched by the Research
 * Agent, so it uses ClaudeAiService.generatePlain rather than web search/fetch.
 */
@Injectable()
export class EmailGenerationService {
  private readonly logger = new Logger(EmailGenerationService.name);

  constructor(
    private readonly claudeAiService: ClaudeAiService,
    private readonly agentRunsService: AgentRunsService,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyIntelligence)
    private readonly intelRepo: Repository<CompanyIntelligence>,
    @InjectRepository(GeneratedAsset)
    private readonly assetRepo: Repository<GeneratedAsset>,
  ) {}

  async generateEmail(
    organizationId: string,
    companyId: string,
  ): Promise<GeneratedAsset> {
    const company = await this.companyRepo.findOne({
      where: { id: companyId, organizationId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const intel = await this.intelRepo.findOne({ where: { companyId } });
    if (!intel || intel.status !== 'completed') {
      throw new BadRequestException(
        'Research not ready — run research on this company first.',
      );
    }

    const run = await this.agentRunsService.start({
      organizationId,
      agentType: 'content',
      contextType: 'company',
      contextId: companyId,
      input: { companyId, assetType: 'email' },
    });

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const raw = await this.claudeAiService.generatePlain(
          buildPrompt(company, intel),
          { system: SYSTEM_PROMPT },
        );
        const parsed = parseEmail(raw);
        const asset = await this.assetRepo.save(
          this.assetRepo.create({
            organizationId,
            companyId,
            type: 'email',
            status: 'completed',
            subject: parsed.subject,
            body: parsed.body,
            metadata: null,
          }),
        );
        await this.agentRunsService.complete(run, { assetId: asset.id });
        return asset;
      } catch (err) {
        lastError = err;
        this.logger.warn(
          `Email generation attempt ${attempt} failed for company ${companyId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const errorMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    await this.agentRunsService.fail(run, errorMessage, MAX_ATTEMPTS - 1);
    throw new BadGatewayException(
      'Email generation failed — try again shortly.',
    );
  }

  async list(organizationId: string): Promise<GeneratedAsset[]> {
    return this.assetRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }
}
