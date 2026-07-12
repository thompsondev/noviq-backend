import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T> {
    return this.dataSource.query(sql, parameters);
  }
}
