import { z } from 'zod';
import type { DatabaseService } from '../../database/database.service';
import type { ClaudeTool } from './tool.types';

/** Options for the DB tool. When you have auth, pass getCurrentUserId so "my account" queries work. */
export type DbToolOptions = {
  getCurrentUserId?: () => Promise<string | null>;
};

const RETRIEVAL_INTENTS = ['account_created_at', 'account_email'] as const;

const inputSchema = z.object({
  intent: z
    .enum(RETRIEVAL_INTENTS)
    .describe(
      'account_created_at: when did the user create their account. account_email: what email is on the user account.',
    ),
});

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

async function handleAccountCreatedAt(
  database: DatabaseService,
  userId: string | null,
): Promise<string> {
  try {
    // Single known query for "when did I create my account". No schema exposed to the model.
    if (!userId) {
      return "I can't look up your account date without knowing who you are. If you're logged in, try asking again from the app.";
    }
    const rows = await database.query<{ createdAt: Date }[]>(
      `SELECT "createdAt" FROM "User" WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const createdAt = rows[0]?.createdAt;
    if (!createdAt) {
      return "I couldn't find an account creation date for you.";
    }
    return `You created your account on ${formatDate(createdAt.toISOString())}.`;
  } catch {
    return "I don't have access to that information right now.";
  }
}

async function handleAccountEmail(
  database: DatabaseService,
  userId: string | null,
): Promise<string> {
  try {
    if (!userId) {
      return "I can't look up your email without knowing who you are. If you're logged in, try asking again from the app.";
    }
    const rows = await database.query<{ email: string | null }[]>(
      `SELECT email FROM "User" WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const email = rows[0]?.email;
    if (email == null || email === '') {
      return "I couldn't find an email on file for your account.";
    }
    return `The email on your account is ${email}.`;
  } catch {
    return "I don't have access to that information right now.";
  }
}

export function createDbTool(
  database: DatabaseService,
  options: DbToolOptions = {},
): ClaudeTool {
  const { getCurrentUserId } = options;

  return {
    name: 'database',
    description: `Use this only to answer the user's question with information that must come from the database. Do NOT list tables, describe schema, or show raw data. Only use when the user asks something like: when they created their account, what email is on their account, or similar factual questions about their data. Call with the appropriate intent and respond to the user with the returned answer.`,
    input_schema: z.toJSONSchema(inputSchema),
    execute: async (input: { intent: (typeof RETRIEVAL_INTENTS)[number] }) => {
      const userId = getCurrentUserId ? await getCurrentUserId() : null;

      switch (input.intent) {
        case 'account_created_at':
          return { answer: await handleAccountCreatedAt(database, userId) };
        case 'account_email':
          return { answer: await handleAccountEmail(database, userId) };
        default:
          return {
            answer: "I don't have a way to look up that information.",
          };
      }
    },
  };
}
