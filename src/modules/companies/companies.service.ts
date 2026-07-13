import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../lib/database/entities/company.entity';
import { CompanySourceService } from '../../lib/company-source/company-source.service';
import { SearchCompaniesDto } from './dto/search-companies.dto';

function describeQuery(dto: SearchCompaniesDto): string {
  return [
    dto.keyword ? `keyword=${dto.keyword}` : null,
    dto.industry ? `industry=${dto.industry}` : null,
    dto.country ? `country=${dto.country}` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly companySource: CompanySourceService,
  ) {}

  async search(
    organizationId: string,
    dto: SearchCompaniesDto,
  ): Promise<{ companies: Company[]; sourceConfigured: boolean }> {
    const results = await this.companySource.search(dto);
    const sourceQuery = describeQuery(dto);

    const companies: Company[] = [];
    for (const result of results) {
      const existing = await this.companyRepo.findOne({
        where: { organizationId, domain: result.domain },
      });
      if (existing) {
        companies.push(existing);
        continue;
      }

      const created = await this.companyRepo.save(
        this.companyRepo.create({
          organizationId,
          name: result.name,
          domain: result.domain,
          industry: result.industry ?? null,
          country: result.country ?? null,
          employeeCount: result.employeeCount ?? null,
          revenue: result.revenue ?? null,
          technologies: result.technologies ?? [],
          fundingStage: result.fundingStage ?? null,
          sourceQuery,
        }),
      );
      companies.push(created);
    }

    return { companies, sourceConfigured: this.companySource.isConfigured };
  }

  async list(organizationId: string): Promise<Company[]> {
    return this.companyRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }
}
