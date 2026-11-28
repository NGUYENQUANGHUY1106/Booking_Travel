import { ConfigService } from '@nestjs/config';
import { ReviewSummaryProvider } from './review-summary.provider';

describe('ReviewSummaryProvider', () => {
  const provider = new ReviewSummaryProvider(
    new ConfigService({
      reviewSummary: {
        enabled: true,
        model: 'gemini-test',
        apiKey: 'test-key',
        timeoutMs: 100,
      },
    }),
  );
  afterEach(() => jest.restoreAllMocks());

  it('sends only indexed text and accepts structured classifications', async () => {
    const comments = ['Phòng sạch 😍', 'Dirty room'];
    const reviews = [
      {
        index: 0,
        sentiment: 'POSITIVE',
        topics: [{ topic: 'ROOM', sentiment: 'POSITIVE' }],
      },
      {
        index: 1,
        sentiment: 'NEGATIVE',
        topics: [{ topic: 'CLEANLINESS', sentiment: 'NEGATIVE' }],
      },
    ];
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: 'hidden' },
                { text: JSON.stringify({ reviews }) },
              ],
            },
          },
        ],
      }),
    );
    await expect(provider.classify(comments)).resolves.toEqual(reviews);
    const [url, init] = fetch.mock.calls[0];
    expect(url).not.toContain('test-key');
    expect(init?.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
    expect(init?.body).toContain(
      JSON.stringify(
        JSON.stringify(comments.map((text, index) => ({ index, text }))),
      ),
    );
  });

  it('rejects invalid classifications', async () => {
    const reviews = [{ index: 0, sentiment: 'UNKNOWN', topics: [] }];
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        candidates: [
          { content: { parts: [{ text: JSON.stringify({ reviews }) }] } },
        ],
      }),
    );
    await expect(provider.classify(['room'])).rejects.toThrow(
      'INVALID_REVIEW_LABEL',
    );
  });

  it('aborts the request on timeout', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(
      async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Request timed out', 'TimeoutError')),
            { once: true },
          );
        }),
    );
    await expect(provider.classify(['room'])).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });

  it('rejects an upstream rate-limit response', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 429 }));
    await expect(provider.classify(['room'])).rejects.toThrow(
      'GEMINI_REVIEW_REQUEST_FAILED',
    );
  });
});
