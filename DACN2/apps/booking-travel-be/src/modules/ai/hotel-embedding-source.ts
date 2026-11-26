import { createHash } from 'node:crypto';

export const CHUNK_SCHEMA = 4;
export type PublicChunk = {
  sourceType: 'HOTEL_OVERVIEW' | 'AMENITIES' | 'HOTEL_POLICY';
  resourceId: string;
  chunkIndex: number;
  language: string;
  excerpt: string;
  contentHash: string;
};

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// Only approved snapshot fields enter this extractor. Free text still needs PII redaction.
export function publicText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[redacted]')
    .replace(
      /\b(?:CCCD|CMND|passport|mã đặt phòng|booking[\s_-]?(?:id|code)|api[\s_-]?key|secret|token)\b\s*[:#-]?\s*[^\s,.;]{3,80}/gi,
      '[redacted]',
    )
    .replace(/(?:\+?84|0)(?:[\s.-]*\d){9,10}\b/g, '[redacted]')
    .replace(/\b(?:\d[\s.-]*){11,12}\b/g, '[redacted]')
    .replace(/\b\d{9,12}\b/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);
}

function field(value: unknown, label: string): string {
  const text = publicText(value);
  return text ? `${label}: ${text}` : '';
}

function policyField(value: unknown, label: string): string {
  // Never quote half a policy: a truncated condition could change its meaning.
  if (typeof value === 'string' && value.length > 3000) return '';
  return field(value, label);
}

export function buildPublicHotelChunks(
  hotelId: string,
  snapshot: unknown,
): { chunks: PublicChunk[]; sourceHash: string } {
  const data =
    snapshot && typeof snapshot === 'object'
      ? (snapshot as Record<string, unknown>)
      : {};
  const policy =
    data.policy && typeof data.policy === 'object'
      ? (data.policy as Record<string, unknown>)
      : {};
  const amenities = Array.isArray(data.amenities)
    ? data.amenities
        .map((item) =>
          item && typeof item === 'object'
            ? publicText((item as Record<string, unknown>).name).slice(0, 80)
            : '',
        )
        .filter(Boolean)
        .slice(0, 30)
    : [];
  const sources: Array<[PublicChunk['sourceType'], string]> = [
    [
      'HOTEL_OVERVIEW',
      [
        field(data.name, 'Khách sạn'),
        field(data.description, 'Mô tả'),
        field(data.checkInTime, 'Giờ nhận phòng'),
        field(data.checkOutTime, 'Giờ trả phòng'),
      ]
        .filter(Boolean)
        .join('. '),
    ],
    [
      'AMENITIES',
      amenities.length
        ? `Tiện nghi: ${[...new Set(amenities)].join(', ')}`
        : '',
    ],
    ['HOTEL_POLICY', policyField(policy.cancellationPolicy, 'Chính sách hủy')],
    ['HOTEL_POLICY', policyField(policy.houseRules, 'Nội quy')],
  ];
  const indices = new Map<PublicChunk['sourceType'], number>();
  const chunks = sources
    .filter(([, text]) => text)
    .map(([sourceType, excerpt]) => {
      const chunkIndex = indices.get(sourceType) ?? 0;
      indices.set(sourceType, chunkIndex + 1);
      return {
        sourceType,
        resourceId: hotelId,
        chunkIndex,
        language: 'vi',
        excerpt: excerpt.slice(0, 3500),
        contentHash: sha256(excerpt),
      };
    });
  return {
    chunks,
    sourceHash: sha256(JSON.stringify({ schema: CHUNK_SCHEMA, chunks })),
  };
}
