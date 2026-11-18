import { PrismaClient, RefundRequestStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  RefundSimulatorSignature,
  type RefundSimulatorEvent,
} from '../src/modules/bookings/refund-simulator-signature';

async function main() {
  const [refundId, outcome] = process.argv.slice(2);
  if (!refundId || !['SUCCESS', 'FAILED'].includes(outcome))
    throw new Error(
      'Usage: npm run refund:simulate -- <refundId> SUCCESS|FAILED',
    );
  const signature = new RefundSimulatorSignature();
  if (!signature.enabled())
    throw new Error(
      'Configure PAYMENT_SIMULATOR_ENABLED=true, merchant ID and 32+ character secret.',
    );
  const prisma = new PrismaClient();
  try {
    const request = await prisma.refundRequest.findUnique({
      where: { id: refundId },
      include: { payment: true },
    });
    if (
      !request ||
      request.status !== RefundRequestStatus.PROCESSING ||
      !request.amount ||
      !request.providerRefundRef ||
      !request.payment.providerTxnId
    )
      throw new Error(
        'Refund must be in PROCESSING with a valid original simulator transaction.',
      );
    const event: RefundSimulatorEvent = {
      eventId: randomUUID(),
      merchantId: signature.merchantId,
      providerRefundRef: request.providerRefundRef,
      originalProviderTxnId: request.payment.providerTxnId,
      amount: request.amount.toString(),
      currency: request.currency,
      status: outcome as 'SUCCESS' | 'FAILED',
      ...(outcome === 'FAILED' ? { failureCode: 'TEST_REFUND_FAILED' } : {}),
    };
    const body = Buffer.from(JSON.stringify(event));
    const timestamp = String(Math.floor(Date.now() / 1000));
    const response = await fetch(
      process.env.REFUND_SIMULATOR_WEBHOOK_URL ??
        'http://localhost:3000/api/refunds/simulator/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-bt-simulator-timestamp': timestamp,
          'x-bt-refund-signature': signature.sign(body, timestamp),
        },
        body,
      },
    );
    console.log(
      JSON.stringify({
        httpStatus: response.status,
        result: await response.json(),
      }),
    );
    if (!response.ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Refund simulation failed.',
  );
  process.exitCode = 1;
});
