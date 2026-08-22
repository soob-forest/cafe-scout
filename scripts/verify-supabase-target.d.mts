export function extractProjectRef(dbUrl: string): string;
export function assertSupabaseTarget(input: {
  dbUrl: string;
  expectedProjectRef: string;
  linkedProjectRef: string;
}): string;
