// In the implicit flow — supabase-js's default — the tokens come back in the
// URL fragment, which a browser never sends to the server. Nothing here can be
// rendered or prerendered ahead of the client.
export const ssr = false;
export const prerender = false;
