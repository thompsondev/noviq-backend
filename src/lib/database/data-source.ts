import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ChatMessage } from './entities/chat-message.entity';
import { Organization } from './entities/organization.entity';
import { User } from './entities/user.entity';
import { Company } from './entities/company.entity';
import { CompanyIntelligence } from './entities/company-intelligence.entity';
import { AgentRun } from './entities/agent-run.entity';
import { GeneratedAsset } from './entities/generated-asset.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env['DATABASE_URL'],
  entities: [
    ChatMessage,
    Organization,
    User,
    Company,
    CompanyIntelligence,
    AgentRun,
    GeneratedAsset,
  ],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
