import { ConfigService } from '@nestjs/config';
import { AssistantProvider } from './assistant-provider';

describe('AssistantProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('reports that no LLM is configured when server credentials are absent', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const provider = new AssistantProvider(config as unknown as ConfigService);

    expect(provider.configured()).toBe(false);
  });

  it('calls an OpenAI-compatible endpoint without exposing the key in output', async () => {
    const values: Record<string, string | number> = {
      'ai.baseUrl': 'https://provider.example/v1/',
      'ai.apiKey': 'server-secret',
      'ai.model': 'test-model',
      'ai.provider': 'compatible-test',
      'ai.timeoutMs': 1000,
    };
    const config = { get: jest.fn((key: string) => values[key]) };
    const fetchMock = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '  Kết quả có căn cứ.  ' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    global.fetch = fetchMock;
    const provider = new AssistantProvider(config as unknown as ConfigService);

    const result = await provider.complete({
      message: 'Tìm khách sạn',
      draftAnswer: 'Có một kết quả.',
      history: [],
      groundedFacts: ['hotelId=hotel-1; tên=Khách sạn thật'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://provider.example/v1/chat/completions',
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: 'Bearer server-secret',
      'Content-Type': 'application/json',
    });
    expect(result).toEqual({
      answer: 'Kết quả có căn cứ.',
      provider: 'compatible-test',
      model: 'test-model',
    });
  });
});
