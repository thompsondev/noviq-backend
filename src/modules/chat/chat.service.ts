import { Injectable, Logger } from '@nestjs/common';
import {
  ClaudeAiService,
  ChatMessage,
  Attachment,
} from '../../lib/claude-ai/claude-ai.service';

const HISTORY_LIMIT = 20;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly claudeAiService: ClaudeAiService) {}

  async generateResponse(prompt: string): Promise<string> {
    return this.claudeAiService.generateResponse(prompt);
  }

  async generateClaudeResponse(prompt: string): Promise<string> {
    return this.claudeAiService.generateResponse(prompt);
  }

  async handleStreamPrompt(
    prompt: string,
    emit: (data: object) => void,
    history?: ChatMessage[],
    attachments?: Attachment[],
  ): Promise<void> {
    const userMessage: ChatMessage = { role: 'user', content: prompt };
    if (attachments?.length) userMessage.attachments = attachments;

    const messages: ChatMessage[] = [
      ...(history ?? []).slice(-HISTORY_LIMIT),
      userMessage,
    ];

    let textDeltaCount = 0;
    try {
      for await (const evt of this.claudeAiService.streamText(messages)) {
        switch (evt.type) {
          case 'text':
            textDeltaCount++;
            emit({ t: 'text', v: evt.text });
            break;
          case 'tool-call':
            this.logger.log(`Tool call: ${evt.name}`);
            break;
          case 'tool-result':
            this.logger.log(`Tool result: ${evt.name}`);
            break;
          case 'done':
            this.logger.log(
              `Stream finished — text deltas: ${textDeltaCount}, reason: ${evt.reason}`,
            );
            emit({ t: 'done' });
            break;
          case 'error':
            this.logger.error(`Stream error event: ${evt.error}`);
            emit({ t: 'error', msg: evt.error });
            break;
        }
      }
      if (textDeltaCount === 0) {
        this.logger.warn(
          'Stream finished with no text from the model. Check ANTHROPIC_API_KEY and model.',
        );
      }
    } catch (err: unknown) {
      const normalized = err as { message?: string; stack?: string };
      this.logger.error('Stream error', normalized.stack ?? String(err));
      emit({ t: 'error', msg: normalized.message ?? 'Stream error' });
    }
  }
}
