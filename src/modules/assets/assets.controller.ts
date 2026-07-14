import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmailGenerationService } from './email-generation.service';
import { GenerateAssetDto } from './dto/generate-asset.dto';
import { SessionGuard } from '../../middleware/guards/session.guard';
import { CurrentUser } from '../../middleware/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../middleware/guards/session.guard';

@ApiTags('Assets')
@Controller('assets')
@UseGuards(SessionGuard)
export class AssetsController {
  constructor(
    private readonly emailGenerationService: EmailGenerationService,
  ) {}

  @Post('generate')
  @ApiOperation({
    summary:
      'Generate a personalized email for a company (requires completed research)',
  })
  async generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateAssetDto,
  ) {
    return this.emailGenerationService.generateEmail(
      user.organizationId,
      dto.companyId,
    );
  }

  @Get()
  @ApiOperation({ summary: "List the organization's generated assets" })
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.emailGenerationService.list(user.organizationId);
  }
}
