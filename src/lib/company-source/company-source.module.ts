import { Global, Module } from '@nestjs/common';
import { CompanySourceService } from './company-source.service';

@Global()
@Module({
  providers: [CompanySourceService],
  exports: [CompanySourceService],
})
export class CompanySourceModule {}
