import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgentRunsService } from './agent-runs.service';
import { SessionGuard } from '../../middleware/guards/session.guard';
import { CurrentUser } from '../../middleware/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../middleware/guards/session.guard';

@ApiTags('Agents')
@Controller('agents')
@UseGuards(SessionGuard)
export class AgentRunsController {
  constructor(private readonly agentRunsService: AgentRunsService) {}

  @Get('runs')
  @ApiOperation({ summary: "List the organization's agent runs" })
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.agentRunsService.list(user.organizationId);
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Get a single agent run' })
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const run = await this.agentRunsService.findOne(user.organizationId, id);
    if (!run) {
      throw new NotFoundException('Agent run not found');
    }
    return run;
  }
}
