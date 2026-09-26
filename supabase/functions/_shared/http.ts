export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...headers },
  });
}

export function errorResponse(
  code: string,
  message: string,
  requestId: string,
  status: number,
): Response {
  return jsonResponse({ error: { code, message, requestId } }, status);
}

export function requestId(): string {
  return crypto.randomUUID();
}

export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (request.method === "GET") return {};
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object"
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}
