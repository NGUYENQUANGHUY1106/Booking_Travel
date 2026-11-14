import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  SimulatorSignature,
  type SimulatorEvent,
} from '../src/modules/payments/simulator-signature';

async function main() {
  const [bookingCode, outcome] = process.argv.slice(2);
  if (!bookingCode || !['SUCCESS', 'FAILED'].includes(outcome)) {
    throw new Error(
      'Usage: npm run payment:simulate -- <bookingCode> SUCCESS|FAILED',
    );
  }
  const verifier = new SimulatorSignature();
  if (!verifier.enabled())
    throw new Error(
      'Configure PAYMENT_SIMULATOR_ENABLED=true, merchant ID and a 32+ character secret in DACN2/.env.',
    );
  const prisma = new PrismaClient();
  try {
    const booking = await prisma.booking.findUnique({
      where: { code: bookingCode },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    const payment = booking?.payments[0];
    if (!payment || payment.provider !== verifier.provider)
      throw new Error('No simulator payment found for this booking code.');
    const event: SimulatorEvent = {
      eventId: randomUUID(),
      merchantId: verifier.merchantId,
      merchantReference: payment.merchantReference,
      providerTxnId: payment.providerTxnId ?? randomUUID(),
      amount: payment.amount.toString(),
      currency: payment.currency,
      status: outcome as 'SUCCESS' | 'FAILED',
      ...(outcome === 'FAILED' ? { failureReason: 'TEST_DECLINED' } : {}),
    };
    const body = Buffer.from(JSON.stringify(event));
    const timestamp = String(Math.floor(Date.now() / 1000));
    const response = await fetch(
      process.env.PAYMENT_SIMULATOR_WEBHOOK_URL ??
        'http://localhost:3000/api/payments/SIMULATOR/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-bt-simulator-timestamp': timestamp,
          'x-bt-simulator-signature': verifier.sign(body, timestamp),
        },
        body,
      },
    );
    const result = await response.json();
    console.log(JSON.stringify({ httpStatus: response.status, result }));
    if (!response.ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Simulator webhook failed.',
  );
  process.exitCode = 1;
});
