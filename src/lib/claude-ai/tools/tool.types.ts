export type ClaudeTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  execute: (input: any) => Promise<unknown>;
};
