/** Minimal root state for effect tests that read connection and auth. */
export function connectionReducerFor(lastSeq: number): Record<string, unknown> {
  return {
    connection: { status: 'online', lastSeq },
    auth: { user: null, status: 'anonymous', submitting: false, error: null },
  };
}
