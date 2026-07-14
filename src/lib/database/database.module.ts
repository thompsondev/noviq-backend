import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from './entities/chat-message.entity';
import { Organization } from './entities/organization.entity';
import { User } from './entities/user.entity';
import { Company } from './entities/company.entity';
import { CompanyIntelligence } from './entities/company-intelligence.entity';
import { AgentRun } from './entities/agent-run.entity';
import { GeneratedAsset } from './entities/generated-asset.entity';
import { DatabaseService } from './database.service';

const entities = [
  ChatMessage,
  Organization,
  User,
  Company,
  CompanyIntelligence,
  AgentRun,
  GeneratedAsset,
];

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities,
        synchronize: false,
        migrationsRun: false,
      }),
    }),
    TypeOrmModule.forFeature(entities),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}
