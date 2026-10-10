import { normalizeVietnameseSearch } from './vietnamese-search';

describe('normalizeVietnameseSearch', () => {
  it('removes Vietnamese diacritics and normalizes whitespace', () => {
    expect(normalizeVietnameseSearch('  Thành phố Hồ Chí Minh  ')).toBe(
      'thanh pho ho chi minh',
    );
  });

  it('normalizes đ/Đ', () => {
    expect(normalizeVietnameseSearch('Đắk Lắk')).toBe('dak lak');
  });
});
