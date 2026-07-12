import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import type { ClaudeTool } from './tool.types';

export type MediaToolOptions = {
  /** Custom prompt used when no user prompt is provided */
  defaultPrompt?: string;
};

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const PDF_TYPE = 'application/pdf';

const TEXT_SHORTCUT_TYPES = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/html',
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
};

/** Infer MIME type from URL extension when the server doesn't send Content-Type */
function mimeFromUrl(url: string): string | null {
  const clean = url.split('?')[0].split('#')[0];
  const ext = clean.split('.').pop()?.toLowerCase();
  return ext ? (EXT_TO_MIME[ext] ?? null) : null;
}

const inputSchema = z.object({
  url: z.string().url().describe('Public URL of the image, PDF, or file.'),
  prompt: z
    .string()
    .optional()
    .describe(
      'What to do with the file – e.g. "describe the image", "extract all text", "summarize the PDF". Defaults to a thorough general analysis.',
    ),
});

/**
 * Factory for the media tool. Pass the same Anthropic client and model used
 * by the caller so analysis runs as a Claude vision/document call.
 */
export function createMediaTool(
  client: Anthropic,
  model: string,
  options: MediaToolOptions = {},
): ClaudeTool {
  return {
    name: 'media',
    description: [
      'Fetch and analyze a file at a URL.',
      'Use when the user provides a URL to an image, PDF, or document and wants its contents described, read, or extracted.',
      'Supported formats: images (JPEG, PNG, GIF, WebP), PDFs, plain text, CSV, Markdown, HTML.',
      'Returns a detailed analysis produced by Claude.',
    ].join(' '),

    input_schema: z.toJSONSchema(inputSchema),

    execute: async ({ url, prompt }: { url: string; prompt?: string }) => {
      // ── 1. Fetch ──────────────────────────────────────────────────────────
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { 'User-Agent': 'AIOS-MediaTool/1.0' },
          signal: AbortSignal.timeout(30_000),
        });
      } catch (err: any) {
        return {
          error: `Could not fetch URL: ${err?.message ?? 'network error'}`,
        };
      }

      if (!response.ok) {
        return {
          error: `URL responded with ${response.status} ${response.statusText}`,
        };
      }

      // ── 2. Resolve MIME type ──────────────────────────────────────────────
      const contentType = response.headers.get('content-type') ?? '';
      const mimeType =
        contentType.split(';')[0].trim() ||
        mimeFromUrl(url) ||
        'application/octet-stream';

      const analysisPrompt =
        prompt ??
        options.defaultPrompt ??
        'Analyze this file thoroughly. For images, describe everything you see in detail. ' +
          'For documents, summarize the content and extract key information.';

      // ── 3. Plain-text shortcut (no model call needed) ────────────────────
      if (TEXT_SHORTCUT_TYPES.has(mimeType)) {
        const text = await response.text();
        const truncated = text.length > 8_000;
        return {
          mimeType,
          url,
          content: text.slice(0, 8_000),
          ...(truncated && {
            note: `Content truncated to 8 000 chars (full size: ${text.length})`,
          }),
        };
      }

      // ── 4. Guard unsupported types ────────────────────────────────────────
      if (!IMAGE_TYPES.has(mimeType) && mimeType !== PDF_TYPE) {
        return {
          error:
            `Unsupported file type "${mimeType}". ` +
            'Supported: JPEG, PNG, GIF, WebP, PDF, TXT, CSV, Markdown, HTML.',
        };
      }

      // ── 5. Read binary as base64 ───────────────────────────────────────────
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      // ── 6. Build the vision/document content block ────────────────────────
      const mediaBlock =
        mimeType === PDF_TYPE
          ? ({
              type: 'document' as const,
              source: {
                type: 'base64' as const,
                media_type: PDF_TYPE,
                data: base64,
              },
            } as const)
          : ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type:
                  mimeType as Anthropic.Messages.Base64ImageSource['media_type'],
                data: base64,
              },
            } as const);

      // ── 7. Analyze via Claude ──────────────────────────────────────────────
      try {
        const message = await client.messages.create({
          model,
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: analysisPrompt }, mediaBlock],
            },
          ],
        });

        const analysis = message.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('');

        return { analysis, mimeType, url };
      } catch (err: any) {
        return {
          error: `Model could not analyze this file: ${err?.message ?? 'unknown error'}`,
          mimeType,
          url,
        };
      }
    },
  };
}
