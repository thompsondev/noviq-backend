import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

import { systemPrompt as SYSTEM_PROMPT } from './sp';
import { createDbTool } from './tools/db.tool';
import { createMediaTool } from './tools/media.tool';
import type { ClaudeTool } from './tools/tool.types';
import { DatabaseService } from '../database/database.service';

const DEFAULT_MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 4096;
const MAX_TOOL_STEPS = 5;

export type Attachment = {
  name: string;
  mimeType: string;
  /** base64-encoded file data */
  data: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
};

export type ClaudeStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; name: string }
  | { type: 'tool-result'; name: string }
  | { type: 'done'; reason: string }
  | { type: 'error'; error: string };

@Injectable()
export class ClaudeAiService {
  private readonly logger = new Logger(ClaudeAiService.name);

  private readonly client: Anthropic | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly database: DatabaseService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.logger.log(
      this.client
        ? `Claude activated — model: ${this.getModel()}`
        : 'Claude not configured (missing ANTHROPIC_API_KEY)',
    );
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private requireClient(): Anthropic {
    if (!this.client) {
      throw new Error('Claude is not configured (missing ANTHROPIC_API_KEY)');
    }
    return this.client;
  }

  private getModel(): string {
    const env = this.configService.get<string>('ANTHROPIC_MODEL')?.trim();
    return env && env.length > 0 ? env : DEFAULT_MODEL;
  }

  private getTools(): ClaudeTool[] {
    const client = this.requireClient();
    return [
      createDbTool(this.database),
      createMediaTool(client, this.getModel()),
    ];
  }

  private buildContent(
    msg: ChatMessage,
  ): string | Anthropic.MessageParam['content'] {
    if (msg.role === 'user' && msg.attachments?.length) {
      const parts: Anthropic.ContentBlockParam[] = [];
      for (const att of msg.attachments) {
        if (att.mimeType.startsWith('image/')) {
          parts.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type:
                att.mimeType as Anthropic.Messages.Base64ImageSource['media_type'],
              data: att.data,
            },
          });
        } else if (att.mimeType === 'application/pdf') {
          parts.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: att.data,
            },
          });
        } else {
          parts.push({
            type: 'text',
            text: `[Attached file "${att.name}" (${att.mimeType}) could not be embedded directly.]`,
          });
        }
      }
      if (msg.content) parts.push({ type: 'text', text: msg.content });
      return parts;
    }
    return msg.content;
  }

  private toAnthropicMessages(
    messages: ChatMessage[],
  ): Anthropic.MessageParam[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: this.buildContent(msg),
    }));
  }

  async generateText(messages: ChatMessage[]): Promise<string> {
    const client = this.requireClient();
    const tools = this.getTools();
    const toolDefs = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool['input_schema'],
    }));

    const anthropicMessages = this.toAnthropicMessages(messages);
    let finalText = '';

    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      const response = await client.messages.create({
        model: this.getModel(),
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: anthropicMessages,
        tools: toolDefs,
      });

      finalText = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const toolUses = response.content.filter(
        (block) => block.type === 'tool_use',
      );
      if (!toolUses.length || response.stop_reason !== 'tool_use') {
        return finalText;
      }

      anthropicMessages.push({ role: 'assistant', content: response.content });
      anthropicMessages.push({
        role: 'user',
        content: await this.runTools(tools, toolUses),
      });
    }

    return finalText || 'I ran out of steps trying to answer that.';
  }

  /**
   * Grounds a response in Anthropic's server-side web search tool rather
   * than the model's own (fabrication-prone) knowledge — used wherever the
   * answer must reflect real, current web content, e.g. company discovery.
   */
  async generateWithWebSearch(
    prompt: string,
    options?: { system?: string; maxSearches?: number },
  ): Promise<string> {
    const client = this.requireClient();
    const tools: Anthropic.ToolUnion[] = [
      {
        type: 'web_search_20260318',
        name: 'web_search',
        max_uses: options?.maxSearches ?? 5,
        // Some models (e.g. Haiku) require this explicitly for web_search.
        allowed_callers: ['direct'],
      },
    ];

    const response = await client.messages.create({
      model: this.getModel(),
      max_tokens: MAX_TOKENS,
      system: options?.system,
      messages: [{ role: 'user', content: prompt }],
      tools,
    });

    // Web search is resolved server-side within this one response, so
    // `content` can contain an earlier "I'll search for..." text block
    // before the tool-use/result blocks, followed by the real synthesized
    // answer. Only the last text block is the actual answer — concatenating
    // all of them corrupts a JSON-only response with that leading commentary.
    const textBlocks = response.content.filter(
      (block) => block.type === 'text',
    );
    return textBlocks.length ? textBlocks[textBlocks.length - 1].text : '';
  }

  async generateResponse(userPrompt: string): Promise<string> {
    return this.generateText([{ role: 'user', content: userPrompt }]);
  }

  async *streamText(
    messages: ChatMessage[],
  ): AsyncGenerator<ClaudeStreamEvent> {
    const client = this.requireClient();
    const tools = this.getTools();
    const toolDefs = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool['input_schema'],
    }));

    const anthropicMessages = this.toAnthropicMessages(messages);

    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      const stream = client.messages.stream({
        model: this.getModel(),
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: anthropicMessages,
        tools: toolDefs,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'text', text: event.delta.text };
        }
      }

      const finalMessage = await stream.finalMessage();
      const toolUses = finalMessage.content.filter(
        (block) => block.type === 'tool_use',
      );

      if (!toolUses.length || finalMessage.stop_reason !== 'tool_use') {
        yield { type: 'done', reason: finalMessage.stop_reason ?? 'stop' };
        return;
      }

      anthropicMessages.push({
        role: 'assistant',
        content: finalMessage.content,
      });

      for (const use of toolUses) {
        yield { type: 'tool-call', name: use.name };
      }
      const toolResults = await this.runTools(tools, toolUses);
      for (const use of toolUses) {
        yield { type: 'tool-result', name: use.name };
      }
      anthropicMessages.push({ role: 'user', content: toolResults });
    }

    yield { type: 'done', reason: 'max_steps' };
  }

  private async runTools(
    tools: ClaudeTool[],
    toolUses: Anthropic.ToolUseBlock[],
  ): Promise<Anthropic.ToolResultBlockParam[]> {
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const tool = tools.find((t) => t.name === use.name);
      let content: string;
      try {
        const result = tool
          ? await tool.execute(use.input)
          : { error: `Unknown tool "${use.name}"` };
        content = JSON.stringify(result);
      } catch (err: unknown) {
        content = JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        });
      }
      results.push({ type: 'tool_result', tool_use_id: use.id, content });
    }
    return results;
  }
}
