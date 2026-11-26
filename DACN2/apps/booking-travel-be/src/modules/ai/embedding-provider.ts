import { Injectable } from '@nestjs/common';

export class EmbeddingProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(code);
  }
}

@Injectable()
export class EmbeddingProvider {
  readonly model = process.env.AI_EMBEDDING_MODEL ?? '';
  readonly provider = process.env.AI_EMBEDDING_PROVIDER || 'openai-compatible';
  readonly dimensions = 1536;

  get configured(): boolean {
    return Boolean(
      process.env.AI_EMBEDDING_ENABLED === 'true' &&
      process.env.AI_EMBEDDING_API_URL &&
      process.env.AI_EMBEDDING_API_KEY &&
      this.model,
    );
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.configured)
      throw new EmbeddingProviderError('PROVIDER_UNCONFIGURED', false);
    if (
      texts.length < 1 ||
      texts.length > 16 ||
      texts.some((text) => !text || text.length > 4000)
    )
      throw new EmbeddingProviderError('INVALID_BATCH', false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(process.env.AI_EMBEDDING_API_URL!, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AI_EMBEDDING_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
          dimensions: this.dimensions,
        }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new EmbeddingProviderError(
          response.status === 429
            ? 'PROVIDER_RATE_LIMIT'
            : `PROVIDER_HTTP_${response.status}`,
          response.status === 429 || response.status >= 500,
        );
      const body = (await response.json()) as {
        model?: string;
        data?: Array<{ index: number; embedding: number[] }>;
      };
      if (body.model && body.model !== this.model)
        throw new EmbeddingProviderError('MODEL_MISMATCH', false);
      const indexes = new Set(body.data?.map((item) => item.index) ?? []);
      if (
        !body.data ||
        body.data.length !== texts.length ||
        Array.from({ length: texts.length }, (_, index) => index).some(
          (index) => !indexes.has(index),
        )
      )
        throw new EmbeddingProviderError('INVALID_RESPONSE_INDEX', false);
      const vectors = body.data
        ?.sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
      if (
        !vectors ||
        vectors.length !== texts.length ||
        vectors.some(
          (vector) =>
            !Array.isArray(vector) ||
            vector.length !== this.dimensions ||
            vector.some((number) => !Number.isFinite(number)) ||
            vector.every((number) => number === 0),
        )
      )
        throw new EmbeddingProviderError('INVALID_DIMENSION', false);
      return vectors;
    } catch (error) {
      if (error instanceof EmbeddingProviderError) throw error;
      throw new EmbeddingProviderError('PROVIDER_TIMEOUT_OR_NETWORK', true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
