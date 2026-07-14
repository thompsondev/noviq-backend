import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClaudeAiService } from '../../lib/claude-ai/claude-ai.service';
import { Company } from '../../lib/database/entities/company.entity';
import { CompanyIntelligence } from '../../lib/database/entities/company-intelligence.entity';
import { AgentRun } from '../../lib/database/entities/agent-run.entity';
import { AgentRunsService } from './agent-runs.service';

const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 2;

const SYSTEM_PROMPT = `You are a company research assistant with a real-time web fetch tool. You only report information you actually found by fetching the company's real website — you never invent products, pricing, competitors, or other details. If the site couldn't be fetched or reveals nothing useful, say so rather than guessing.`;

function buildPrompt(domain: string): string {
  return `Fetch https://${domain} using your web fetch tool (and, if useful, one or two additional pages linked from it, such as an About, Products, or Pricing page). Based ONLY on what you actually find, respond with ONLY a JSON object (no commentary before or after) shaped exactly like:
{"status": "completed" or "insufficient_data", "summary": "1-2 sentence overview or null", "products": ["..."], "pricing": "short pricing description or null", "competitors": ["..."], "techStack": ["..."], "painPoints": ["..."]}

Rules:
- "status" is "insufficient_data" if the site couldn't be fetched or contains essentially no useful business information — in that case use empty arrays and null for the other fields
- Only include products/competitors/techStack/painPoints you actually found evidence for on the fetched pages — never guess or fabricate
- "competitors" are companies explicitly named as alternatives on the site; omit if none are mentioned
- "techStack" are technologies you can actually detect from the fetched content (e.g. platform mentions, footer credits); omit if none detected
- "painPoints" are customer problems the site's own messaging says it solves; omit if unclear
- Respond with the JSON object and nothing else`;
}

function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in response');
  }
  return text.slice(start, end + 1);
}

interface ParsedResearch {
  status: 'completed' | 'insufficient_data';
  summary: string | null;
  products: string[];
  pricing: string | null;
  competitors: string[];
  techStack: string[];
  painPoints: string[];
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}

function parseResearch(raw: string): ParsedResearch {
  const jsonText = extractJsonObject(raw.trim());
  const parsed: unknown = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Expected a JSON object');
  }
  const record = parsed as Record<string, unknown>;

  return {
    status:
      record.status === 'insufficient_data' ? 'insufficient_data' : 'completed',
    summary: typeof record.summary === 'string' ? record.summary : null,
    products: toStringArray(record.products),
    pricing: typeof record.pricing === 'string' ? record.pricing : null,
    competitors: toStringArray(record.competitors),
    techStack: toStringArray(record.techStack),
    painPoints: toStringArray(record.painPoints),
  };
}

export interface ResearchResult {
  intelligence: CompanyIntelligence;
  cached: boolean;
  run: AgentRun | null;
}

/**
 * The Research Agent (see docs/05-ai-agent-system.md): given a company,
 * fetches its real website via Claude's web fetch tool and extracts
 * structured findings — never fabricated, same grounding discipline as
 * CompanySourceService for Discover.
 */
@Injectable()
export class ResearchAgentService {
  private readonly logger = new Logger(ResearchAgentService.name);

  constructor(
    private readonly claudeAiService: ClaudeAiService,
    private readonly agentRunsService: AgentRunsService,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyIntelligence)
    private readonly intelRepo: Repository<CompanyIntelligence>,
  ) {}

  async research(
    organizationId: string,
    companyId: string,
  ): Promise<ResearchResult> {
    const company = await this.companyRepo.findOne({
      where: { id: companyId, organizationId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const existing = await this.intelRepo.findOne({
      where: { companyId },
    });
    if (
      existing &&
      Date.now() - existing.generatedAt.getTime() < FRESHNESS_WINDOW_MS
    ) {
      return { intelligence: existing, cached: true, run: null };
    }

    const run = await this.agentRunsService.start({
      organizationId,
      agentType: 'research',
      contextType: 'company',
      contextId: companyId,
      input: { domain: company.domain },
    });

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const raw = await this.claudeAiService.generateWithWebFetch(
          buildPrompt(company.domain),
          {
            system: SYSTEM_PROMPT,
            maxFetches: 3,
            allowedDomains: [company.domain],
          },
        );
        const parsed = parseResearch(raw);
        const intelligence = await this.upsertIntelligence(
          companyId,
          existing,
          parsed,
        );
        await this.agentRunsService.complete(run, { status: parsed.status });
        return { intelligence, cached: false, run };
      } catch (err) {
        lastError = err;
        this.logger.warn(
          `Research attempt ${attempt} failed for ${company.domain}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const errorMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    await this.agentRunsService.fail(run, errorMessage, MAX_ATTEMPTS - 1);
    throw new BadGatewayException(
      'Research failed — the AI research step could not complete. Try again shortly.',
    );
  }

  private async upsertIntelligence(
    companyId: string,
    existing: CompanyIntelligence | null,
    parsed: ParsedResearch,
  ): Promise<CompanyIntelligence> {
    const intelligence = existing ?? this.intelRepo.create({ companyId });
    intelligence.status = parsed.status;
    intelligence.summary = parsed.summary;
    intelligence.products = parsed.products;
    intelligence.pricing = parsed.pricing;
    intelligence.competitors = parsed.competitors;
    intelligence.techStack = parsed.techStack;
    intelligence.painPoints = parsed.painPoints;
    return this.intelRepo.save(intelligence);
  }
}
