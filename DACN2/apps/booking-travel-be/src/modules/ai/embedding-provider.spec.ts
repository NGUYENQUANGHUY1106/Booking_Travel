import {
  EmbeddingProvider,
  EmbeddingProviderError,
} from './embedding-provider';

describe('embedding provider adapter', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.AI_EMBEDDING_ENABLED = 'true';
    process.env.AI_EMBEDDING_API_URL = 'https://example.invalid/embeddings';
    process.env.AI_EMBEDDING_API_KEY = 'test-only';
    process.env.AI_EMBEDDING_MODEL = 'test-model';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('classifies rate limits as retryable without exposing response text', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(new EmbeddingProvider().embed(['hotel'])).rejects.toEqual(
      new EmbeddingProviderError('PROVIDER_RATE_LIMIT', true),
    );
  });

  it('rejects wrong dimensions permanently', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ index: 0, embedding: [1, 0] }] }),
    });
    await expect(new EmbeddingProvider().embed(['hotel'])).rejects.toEqual(
      new EmbeddingProviderError('INVALID_DIMENSION', false),
    );
  });

  it('does not invent vectors when provider is unconfigured', async () => {
    process.env.AI_EMBEDDING_API_KEY = '';
    await expect(new EmbeddingProvider().embed(['hotel'])).rejects.toEqual(
      new EmbeddingProviderError('PROVIDER_UNCONFIGURED', false),
    );
    expect(global.fetch).toBe(originalFetch);
  });
});
