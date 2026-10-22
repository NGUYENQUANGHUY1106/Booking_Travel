import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LogoutDto } from './logout.dto';

describe('LogoutDto', () => {
  it.each([{}, { allSessions: false }, { allSessions: true }])(
    'accepts a valid logout selection',
    async (input) => {
      const errors = await validate(plainToInstance(LogoutDto, input));

      expect(errors).toHaveLength(0);
    },
  );

  it.each(['true', 1, null])(
    'rejects non-boolean allSessions value %p',
    async (allSessions) => {
      const errors = await validate(
        plainToInstance(LogoutDto, { allSessions }),
      );

      expect(errors).not.toHaveLength(0);
    },
  );
});
