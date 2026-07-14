/**
 * Models don't reliably follow "respond with ONLY JSON" — lead-in prose
 * ("Based on my search, here are..." / "I'll search for...") is common even
 * when explicitly told not to. Extract by bracket position instead of
 * trusting the whole response is valid JSON on its own.
 */
export function extractJsonArray(text: string): string {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in response');
  }
  return text.slice(start, end + 1);
}

export function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in response');
  }
  return text.slice(start, end + 1);
}
