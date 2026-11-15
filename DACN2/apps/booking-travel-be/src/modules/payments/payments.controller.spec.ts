import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { PaymentsController } from './payments.controller';

describe('PaymentsController authorization', () => {
  it('cho phép User và Hotel Owner thanh toán booking của chính họ', () => {
    const roles: unknown = Reflect.getMetadata(ROLES_KEY, PaymentsController);

    expect(roles).toEqual([UserRole.USER, UserRole.HOTEL_OWNER]);
  });
});
