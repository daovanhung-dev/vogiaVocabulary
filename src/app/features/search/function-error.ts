interface FunctionErrorLike {
  message?: unknown;
  context?: { status?: unknown } | Response;
}

export function toLexiconError(error: unknown): Error {
  const candidate = error && typeof error === 'object'
    ? error as FunctionErrorLike
    : null;
  const context = candidate?.context;
  const status = context && typeof context === 'object' && 'status' in context
    ? Number((context as { status?: unknown }).status)
    : undefined;
  const message = typeof candidate?.message === 'string'
    ? candidate.message
    : error instanceof Error
    ? error.message
    : String(error ?? '');

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
