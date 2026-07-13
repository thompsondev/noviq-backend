import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { SearchCompaniesDto } from './dto/search-companies.dto';
import { SessionGuard } from '../../middleware/guards/session.guard';
import { CurrentUser } from '../../middleware/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../middleware/guards/session.guard';
import { ResearchAgentService } from '../agents/research-agent.service';

@ApiTags('Companies')
@Controller('companies')
@UseGuards(SessionGuard)
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly researchAgentService: ResearchAgentService,
  ) {}

  @Post('search')
  @ApiOperation({
    summary: 'Discover: search companies, persisting new matches',
  })
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SearchCompaniesDto,
  ) {
    return this.companiesService.search(user.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the organization's discovered companies" })
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.list(user.organizationId);
  }

  @Post(':id/research')
  @ApiOperation({
    summary:
      'Run the Research Agent on a company (returns cached results within 24h)',
  })
  async research(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.researchAgentService.research(user.organizationId, id);
  }
}
