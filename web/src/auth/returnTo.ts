// Where to send the admin after signing in again: the page they were on, carried
// through the OIDC round trip in the sign-in state.
export interface SigninState {
  returnTo?: string;
}

export const currentReturnTo = (): string => window.location.pathname + window.location.search;

// Accept only same-origin relative paths ("/admin?x=1"), never "//evil.example" or
// "/\evil.example", which browsers treat as protocol-relative URLs.
export const safeReturnTo = (state: unknown): string | null => {
  const returnTo = (state as SigninState | null | undefined)?.returnTo;
  if (typeof returnTo !== 'string' || !returnTo.startsWith('/')) return null;
  if (returnTo.startsWith('//') || returnTo.startsWith('/\\')) return null;
  try {
    const url = new URL(returnTo, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (url.pathname.startsWith('/auth/callback')) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
};
