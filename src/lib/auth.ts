const adminKey = process.env.ADMIN_KEY;

if (!adminKey) {
  throw new Error('Missing ADMIN_KEY environment variable.');
}

export function requireAdmin(request: Request): Response | null {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const token = authHeader.slice('bearer '.length).trim();

  if (token !== adminKey) {
    return new Response('Forbidden', { status: 403 });
  }

  return null;
}
