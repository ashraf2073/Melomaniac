const NETWORK =
  /fetch failed|network request failed|unable to resolve host|unknownhost|no address associated|timed out|timeout|failed to connect|connection (reset|refused|closed|abort)|software caused connection abort/i;

function messageOf(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

/**
 * Turns raw errors (Java exception text, Postgres messages) into one plain
 * sentence that is safe to show on screen.
 */
export function describeError(error: unknown, fallback = 'Something went wrong'): string {
  const message = messageOf(error);
  if (!message) return fallback;
  if (NETWORK.test(message)) {
    return "Can't reach the server. Check that your phone has working internet, then try again.";
  }
  if (/permission denied for (table|function|schema|sequence)/i.test(message)) {
    return "The database isn't set up for the app yet. The owner needs to run schema.sql again in Supabase.";
  }
  if (/could not find the function|pgrst202/i.test(message)) {
    return "The admin setup isn't in the database yet. Run schema.sql in Supabase, then pull down to refresh.";
  }
  if (/admins only/i.test(message)) return 'Only admins can do that.';
  if (/row-level security/i.test(message)) return "You don't have permission to do that.";
  if (/jwt expired|invalid jwt/i.test(message)) return 'Your session expired. Sign out and sign in again.';
  return message;
}
