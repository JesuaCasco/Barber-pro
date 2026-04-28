import { Buffer } from 'node:buffer';

const UPSTREAM_URL = 'https://yafvayoaqgoibxrbburd.supabase.co';

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

const readRawBody = async (req) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
};

const buildUpstreamHeaders = (req, body) => {
  const headers = new Headers();

  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (value == null) return;

    const normalizedKey = key.toLowerCase();
    if (normalizedKey === 'host' || normalizedKey === 'content-length' || normalizedKey === 'x-forwarded-host') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry));
      return;
    }

    headers.set(key, value);
  });

  if (body && !headers.has('content-length')) {
    headers.set('content-length', String(body.byteLength));
  }

  return headers;
};

const sendResponseHeaders = (res, upstreamResponse) => {
  upstreamResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-length') return;
    res.setHeader(key, value);
  });
};

export default async function handler(req, res) {
  const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const upstreamUrl = `${UPSTREAM_URL}${requestUrl.pathname.replace(/^\/api\/supabase/, '')}${requestUrl.search}`;
  const method = (req.method || 'GET').toUpperCase();
  const body = METHODS_WITHOUT_BODY.has(method) ? undefined : await readRawBody(req);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers: buildUpstreamHeaders(req, body),
      body,
      redirect: 'manual',
    });

    const responseBody = Buffer.from(await upstreamResponse.arrayBuffer());
    sendResponseHeaders(res, upstreamResponse);
    res.statusCode = upstreamResponse.status;
    res.end(responseBody);
    return;
  } catch (error) {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: 'supabase_proxy_error',
        message: error instanceof Error ? error.message : 'No se pudo contactar a Supabase.',
      }),
    );
  }
}
