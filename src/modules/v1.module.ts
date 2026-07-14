import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { AgentsModule } from './agents/agents.module';
import { AssetsModule } from './assets/assets.module';

@Module({
  imports: [
    ChatModule,
    AuthModule,
    CompaniesModule,
    AgentsModule,
    AssetsModule,
  ],
})
export class V1Module {}
