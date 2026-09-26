interface FunctionErrorLike {
  message?: unknown;
  context?: { status?: unknown } | Response;
}

interface FunctionPayload {
  error?: { code?: unknown; message?: unknown };
}

export async function toLexiconError(error: unknown): Promise<Error> {
  const candidate = error && typeof error === 'object'
    ? error as FunctionErrorLike
    : null;
  const context = candidate?.context;
  const status = context && typeof context === 'object' && 'status' in context
    ? Number((context as { status?: unknown }).status)
    : undefined;
  const payload = await readFunctionPayload(context);
  const code = typeof payload?.error?.code === 'string' ? payload.error.code : '';
  const payloadMessage = typeof payload?.error?.message === 'string' ? payload.error.message : '';
  const message = typeof candidate?.message === 'string'
    ? candidate.message
    : error instanceof Error
    ? error.message
    : String(error ?? '');

  if (code === 'LANGUAGE_MISMATCH') {
    return new Error(payloadMessage || 'The word does not match this deck language. Choose a deck with the correct learning language.');
  }

  if (code === 'DETAILS_UNAVAILABLE') {
    return new Error(payloadMessage || 'No definition is available for this word in the selected deck language.');
  }

  if (code === 'LEXICON_PROVIDER_TIMEOUT' || code === 'LEXICON_PROVIDER_FAILED') {
    return new Error('The dictionary provider is temporarily unavailable. Please try again shortly.');
  }

  if (status === 404 || /requested function was not found|function\s+not\s+found/i.test(message)) {
    return new Error('Lexicon API chưa được deploy lên Supabase. Hãy deploy function lexicon-api rồi thử lại.');
  }

  if (status === 401 || /auth_required|unauthorized|jwt/i.test(message)) {
    return new Error('Phiên làm việc đã hết hạn. Hãy tải lại trang để tạo anonymous session mới.');
  }

  if (/failed to send a request|network|fetch failed|failed to fetch/i.test(message)) {
    return new Error('Không thể kết nối Lexicon API. Hãy kiểm tra function lexicon-api và thử lại.');
  }

  return error instanceof Error
    ? error
    : new Error(message || 'Lexicon request failed.');
}

async function readFunctionPayload(context: FunctionErrorLike['context']): Promise<FunctionPayload | null> {
  if (!(context instanceof Response)) return null;
  try {
    return await context.clone().json() as FunctionPayload;
  } catch {
    return null;
  }
}
