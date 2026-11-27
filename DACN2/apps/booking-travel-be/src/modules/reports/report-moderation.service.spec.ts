import { ConflictException } from '@nestjs/common';
import { HotelReportStatus, ReportTargetType, UserRole } from '@prisma/client';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AdminHotelManagementService } from '../hotels/admin-hotel-management.service';
import { ReportModerationService } from './report-moderation.service';

function setup() {
  let capturedAction:
    { data: { reportId: string; action: string; reason: string } } | undefined;
  const report = {
    id: 'r1',
    reviewId: 'v1',
    reporterId: 'u1',
    status: HotelReportStatus.IN_REVIEW,
    assigneeId: 'admin1',
  };
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    reviewReport: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(report)),
      updateMany: jest.fn().mockImplementation(() => {
        report.status = HotelReportStatus.RESOLVED;
        return Promise.resolve({ count: 1 });
      }),
    },
    review: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    reviewActionAudit: { create: jest.fn().mockResolvedValue({}) },
    reportModerationAction: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(
        (args: {
          data: { reportId: string; action: string; reason: string };
        }) => {
          capturedAction = args;
          return Promise.resolve({});
        },
      ),
    },
  };
  const prisma = {
    $transaction: jest.fn((run: (tx: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
    reportModerationAction: { findUnique: jest.fn().mockResolvedValue(null) },
    userNotification: { create: jest.fn().mockResolvedValue({}) },
  };
  const service = new ReportModerationService(
    prisma as unknown as PrismaService,
    {} as AdminHotelManagementService,
  );
  const actor = { id: 'admin1', role: UserRole.ADMIN, permissions: [] };
  return {
    service,
    tx,
    prisma,
    report,
    actor,
    getCapturedAction: () => capturedAction,
  };
}

describe('ReportModerationService', () => {
  it('hides a review, closes its report and writes audit in the same transaction', async () => {
    const { service, tx, actor, getCapturedAction } = setup();
    await expect(
      service.decide(ReportTargetType.REVIEW, 'r1', actor, {
        action: 'HIDE',
        reason: 'Nội dung đánh giá vi phạm quy định.',
        requestId: 'request-01',
      }),
    ).resolves.toMatchObject({ status: 'RESOLVED' });
    expect(tx.review.updateMany).toHaveBeenCalledWith({
      where: { id: 'v1', isVisible: true },
      data: { isVisible: false },
    });
    expect(tx.reviewReport.updateMany).toHaveBeenCalled();
    expect(tx.reviewActionAudit.create).toHaveBeenCalled();
    expect(getCapturedAction()?.data).toMatchObject({
      reportId: 'r1',
      action: 'HIDE',
      reason: 'Nội dung đánh giá vi phạm quy định.',
    });
  });

  it('rejects a second decision after the report is terminal', async () => {
    const { service, tx, actor, report } = setup();
    report.status = HotelReportStatus.RESOLVED;
    await expect(
      service.decide(ReportTargetType.REVIEW, 'r1', actor, {
        action: 'HIDE',
        reason: 'Nội dung đánh giá vi phạm quy định.',
        requestId: 'request-02',
      }),
    ).rejects.toThrow(ConflictException);
    expect(tx.review.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an action by an admin who has not claimed the report', async () => {
    const { service, tx, actor } = setup();
    await expect(
      service.decide(
        ReportTargetType.REVIEW,
        'r1',
        { ...actor, id: 'admin2' },
        {
          action: 'HIDE',
          reason: 'Nội dung đánh giá vi phạm quy định.',
          requestId: 'request-03',
        },
      ),
    ).rejects.toThrow(ConflictException);
    expect(tx.review.updateMany).not.toHaveBeenCalled();
  });
});
