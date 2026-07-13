import { Injectable, Logger } from '@nestjs/common';
import { ClaudeAiService } from '../claude-ai/claude-ai.service';

export interface CompanySearchQuery {
  keyword?: string;
  industry?: string;
  country?: string;
}

export interface CompanySourceResult {
  name: string;
  domain: string;
  industry?: string | null;
  country?: string | null;
  employeeCount?: number | null;
  revenue?: string | null;
  technologies?: string[];
  fundingStage?: string | null;
}

const SYSTEM_PROMPT = `You are a company research assistant with a real-time web search tool. You only report companies you actually found via search results — you never invent, guess, or pad results with companies you didn't verify via search. If a detail can't be verified, use null for it rather than guessing.`;

const MAX_RESULTS = 10;

function buildPrompt(query: CompanySearchQuery): string {
  const criteria = [
    query.keyword ? `Keyword/product: ${query.keyword}` : null,
    query.industry ? `Industry: ${query.industry}` : null,
    query.country ? `Country: ${query.country}` : null,
  ].filter(Boolean);

  const criteriaText = criteria.length
    ? criteria.join('\n')
    : 'No specific filters — find a diverse sample of currently operating companies.';

  return `Search the web to find up to ${MAX_RESULTS} real, currently operating companies matching:
${criteriaText}

Use your web search tool to look these up before answering. Then respond with ONLY a JSON array (no markdown code fences, no commentary before or after) of objects shaped exactly like:
[{"name": "string", "domain": "string", "industry": "string or null", "country": "string or null", "employeeCount": number or null, "fundingStage": "string or null"}]

Rules:
- "domain" must be the company's real primary website domain you found via search (no "https://", no "www.", no trailing slash)
- Only include companies you actually found evidence for via search — never fabricate a company, name, or domain
- "employeeCount" is an integer only if you found a reliable estimate, otherwise null
- "fundingStage" is one of "bootstrapped", "seed", "series-a", "series-b", "series-c+", "public", or null if unknown
- If you find fewer than ${MAX_RESULTS} genuine matches, return fewer — do not pad with invented companies
- If you find zero genuine matches, return []
- Respond with the JSON array and nothing else`;
}

function sanitizeDomain(domain: string): string {
  return domain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

function parseResults(raw: string): CompanySourceResult[] {
  const jsonText = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsed: unknown = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array');
  }

  const results: CompanySourceResult[] = [];
  for (const item of parsed) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof (item as Record<string, unknown>).name !== 'string' ||
      typeof (item as Record<string, unknown>).domain !== 'string'
    ) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const domain = sanitizeDomain(record.domain as string);
    if (!domain) continue;

    results.push({
      name: (record.name as string).trim(),
      domain,
      industry: typeof record.industry === 'string' ? record.industry : null,
      country: typeof record.country === 'string' ? record.country : null,
      employeeCount:
        typeof record.employeeCount === 'number' ? record.employeeCount : null,
      fundingStage:
        typeof record.fundingStage === 'string' ? record.fundingStage : null,
    });
  }
  return results.slice(0, MAX_RESULTS);
}

/**
 * Company discovery grounded in Claude's web search tool (see
 * docs/02-system-architecture.md) — not a paid data provider like
 * Clearbit/Apollo, and not free-form generation either: every result must
 * come from an actual search hit, and a failed/unavailable search degrades
 * to an empty list rather than fabricated companies.
 */
@Injectable()
export class CompanySourceService {
  private readonly logger = new Logger(CompanySourceService.name);

  constructor(private readonly claudeAiService: ClaudeAiService) {}

  get isConfigured(): boolean {
    return this.claudeAiService.isConfigured();
  }

  async search(query: CompanySearchQuery): Promise<CompanySourceResult[]> {
    if (!this.isConfigured) {
      this.logger.warn(
        `Claude not configured — search skipped for ${JSON.stringify(query)}`,
      );
      return [];
    }

    try {
      const raw = await this.claudeAiService.generateWithWebSearch(
        buildPrompt(query),
        { system: SYSTEM_PROMPT, maxSearches: 5 },
      );
      return parseResults(raw);
    } catch (err) {
      this.logger.error(
        `Company search failed for ${JSON.stringify(query)}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }
}
