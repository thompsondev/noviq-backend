import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ChatMessage } from './entities/chat-message.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env['DATABASE_URL'],
  entities: [ChatMessage],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
