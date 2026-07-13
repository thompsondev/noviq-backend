import { Injectable } from '@nestjs/common';

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

/**
 * No company data provider (Clearbit/Apollo/Crunchbase/a scraper) is
 * configured yet — see docs/02-system-architecture.md and
 * docs/12-roadmap.md. `search` returns an empty list rather than fabricated
 * results; `isConfigured` lets callers distinguish "no provider" from
 * "provider found nothing" so the UI can show an honest empty state. Swap
 * the body of `search` for a real provider call once one is picked; every
 * caller in this codebase goes through this one method.
 */
@Injectable()
export class CompanySourceService {
  private readonly providerConfigured = false;

  get isConfigured(): boolean {
    return this.providerConfigured;
  }

  async search(query: CompanySearchQuery): Promise<CompanySourceResult[]> {
    if (!this.providerConfigured) {
      console.log(
        `[company-source:dev] no provider configured — search skipped for ${JSON.stringify(query)}`,
      );
      return [];
    }
    return [];
  }
}
