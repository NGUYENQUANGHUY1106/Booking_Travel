import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { AiModule } from '../src/modules/ai/ai.module';
import { HotelEmbeddingQueueService } from '../src/modules/ai/hotel-embedding-queue.service';

@Module({ imports: [DatabaseModule, AiModule] })
class BackfillModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(BackfillModule, {
    logger: ['error', 'warn'],
  });
  try {
    const queue = app.get(HotelEmbeddingQueueService);
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const start =
      args.find((arg) => arg.startsWith('--cursor='))?.slice(9) ?? '';
    let cursor: string | null = start;
    const totals = { scanned: 0, enqueued: 0, removed: 0 };
    while (cursor !== null) {
      const result = await queue.reconcile(cursor, 100, dryRun);
      totals.scanned += result.scanned;
      totals.enqueued += result.enqueued;
      totals.removed += result.removed;
      cursor = result.nextCursor;
      process.stdout.write(`${JSON.stringify({ ...result, dryRun })}\n`);
    }
    process.stdout.write(
      `${JSON.stringify({ totals, diagnostics: await queue.diagnostics() })}\n`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Hotel embedding backfill failed: ${error instanceof Error ? error.name : 'UNKNOWN'}\n`,
  );
  process.exitCode = 1;
});
