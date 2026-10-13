import { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, View, type GestureResponderEvent } from 'react-native';

import { ACCOMMODATION_LABELS, AMENITIES, HOTELS, ROOM_AMENITIES, currency, dateLabel, type AccommodationType, type Amenity, nights } from './data';
import { searchHotels } from './search-engine';
import { useTravelerStore, type SearchFilters, type SortKey } from './store';
import { colors } from './theme';
import { Button, Card, Chip, EmptyState, Field, FigmaIcon, HotelCard, SectionTitle, T, TravelerScaffold, go } from './ui';

export type SearchScreenId = 'search-entry' | 'destination' | 'dates' | 'guests' | 'results' | 'filters' | 'sort' | 'map' | 'map-preview' | 'accommodation' | 'amenities' | 'no-results';

const TYPES = Object.keys(ACCOMMODATION_LABELS) as AccommodationType[];
const TYPE_ICONS: Record<AccommodationType, number> = {
  HOTEL: require('./assets/e5e2d.svg'), RESORT: require('./assets/0e966.svg'), APARTMENT: require('./assets/cf9b6.svg'), VILLA: require('./assets/e55c6.svg'), HOMESTAY: require('./assets/845f2.svg'), HOSTEL: require('./assets/b1b25.svg'),
};
const SORT_OPTIONS: { value: SortKey; label: string; detail?: string }[] = [
  { value: 'recommended', label: 'Đề xuất cho bạn', detail: 'Dựa trên mức độ phù hợp, đánh giá và giá.' },
  { value: 'priceAsc', label: 'Giá: thấp đến cao' }, { value: 'priceDesc', label: 'Giá: cao đến thấp' },
  { value: 'rating', label: 'Điểm đánh giá: cao đến thấp' }, { value: 'nearest', label: 'Khoảng cách: gần đến xa' },
  { value: 'popular', label: 'Độ phổ biến' }, { value: 'deals', label: 'Ưu đãi tốt nhất' },
];

function activeFilterCount(filters: SearchFilters): number {
  return Number(filters.minPrice > 0 || filters.maxPrice < 5000000)
    + Number(filters.stars.length > 0)
    + filters.amenities.length
    + Number(filters.freeCancellation)
    + Number(filters.types.length > 0 && !(filters.types.length === 1 && filters.types[0] === 'HOTEL'));
}

function PriceRangeSlider({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  const [width, setWidth] = useState(300);
  const activeThumb = useRef<'min' | 'max'>('min');
  const left = Math.max(0, Math.min(width, min / 5000000 * width));
  const right = Math.max(0, Math.min(width, max / 5000000 * width));
  const valueAt = (event: GestureResponderEvent) => Math.max(0, Math.min(5000000, Math.round(event.nativeEvent.locationX / width * 5000000 / 50000) * 50000));
  const change = (event: GestureResponderEvent) => {
    const value = valueAt(event);
    onChange(activeThumb.current === 'min' ? Math.min(value, max) : min, activeThumb.current === 'max' ? Math.max(value, min) : max);
  };

  return <View accessibilityLabel="Chọn khoảng giá" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={(event) => { activeThumb.current = Math.abs(event.nativeEvent.locationX - left) <= Math.abs(event.nativeEvent.locationX - right) ? 'min' : 'max'; change(event); }} onResponderMove={change} style={{ height: 42, justifyContent: 'center', marginHorizontal: 15 }}>
    <View style={{ height: 5, backgroundColor: colors.line, borderRadius: 3 }} />
    <View style={{ position: 'absolute', left, width: Math.max(0, right - left), height: 5, backgroundColor: colors.primary, borderRadius: 3 }} />
    {[left, right].map((position, index) => <View key={index} style={{ position: 'absolute', left: position - 10, width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: colors.primary, backgroundColor: colors.white }} />)}
  </View>;
}

export const getResults = (destination: string, filters: SearchFilters, sort: SortKey) => searchHotels(HOTELS, destination, filters, sort);

function StaySummary({ onPress }: { onPress?: () => void }) {
  const { destination, checkIn, checkOut, adults, rooms } = useTravelerStore();
  return <Card onPress={onPress} style={{ backgroundColor: colors.primaryLight, padding: 14, gap: 3 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><T weight="semibold" style={{ fontSize: 16 }}>{destination || 'Chọn điểm đến'}</T><T weight="semibold" style={{ color: colors.primary, fontSize: 13 }}>Sửa</T></View><T style={{ color: colors.muted, fontSize: 12 }}>{dateLabel(checkIn)}–{dateLabel(checkOut)} · {adults} khách · {rooms} phòng</T></Card>;
}

function TypeGrid({ selected, toggle, preview = false }: { selected: AccommodationType[]; toggle: (type: AccommodationType) => void; preview?: boolean }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{TYPES.slice(0, preview ? 2 : 6).map((type) => <Pressable accessibilityRole="button" accessibilityState={{ selected: selected.includes(type) }} key={type} onPress={() => toggle(type)} style={{ width: '48%', height: 86, backgroundColor: selected.includes(type) ? colors.primaryLight : colors.white, borderWidth: 1, borderColor: selected.includes(type) ? colors.primary : colors.line, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 5 }}><FigmaIcon source={TYPE_ICONS[type]} size={28} /><T weight="semibold" style={{ color: selected.includes(type) ? colors.primary : colors.ink, fontSize: 14 }}>{ACCOMMODATION_LABELS[type]}</T></Pressable>)}</View>;
}

function AmenityChips({ selected, toggle, limit = 6 }: { selected: string[]; toggle: (value: Amenity) => void; limit?: number }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{AMENITIES.slice(0, limit).map((amenity) => <Chip key={amenity} label={amenity} onPress={() => toggle(amenity)} selected={selected.includes(amenity)} />)}</View>;
}

function SearchEntryScreen() {
  const { filters, setFilters } = useTravelerStore();
  const toggleType = (type: AccommodationType) => setFilters({ types: filters.types.includes(type) ? filters.types.filter((item) => item !== type) : [...filters.types, type] });
  const toggleAmenity = (amenity: Amenity) => setFilters({ amenities: filters.amenities.includes(amenity) ? filters.amenities.filter((item) => item !== amenity) : [...filters.amenities, amenity] });
  const count = getResults(useTravelerStore.getState().destination, filters, useTravelerStore.getState().sort).length;
  return <TravelerScaffold title="Tìm khách sạn" footer={<Button label={`Tìm ${count} chỗ nghỉ`} onPress={() => go('results')} />}>
    <StaySummary onPress={() => go('destination')} />
    <Card onPress={() => go('ai-search')} style={{ backgroundColor: colors.violetLight }}><T style={{ fontSize: 14 }}>✦ Để AI gợi ý nơi ở hợp với bạn</T></Card>
    <SectionTitle title="Chọn loại chỗ ở" action="Xem tất cả →" onPress={() => go('accommodation')} />
    <TypeGrid preview selected={filters.types} toggle={toggleType} />
    <SectionTitle title="Tiện ích nổi bật" action="Xem tất cả →" onPress={() => go('amenities')} />
    <AmenityChips selected={filters.amenities} toggle={toggleAmenity} />
    <Card onPress={() => go('amenities')} style={{ borderWidth: 1, borderColor: colors.line }}><T weight="semibold">Tiện nghi phòng</T><T style={{ color: colors.muted, fontSize: 12 }}>Ban công · Bồn tắm · View biển</T></Card>
    <Card onPress={() => go('filters')}><T weight="semibold">Bộ lọc đang áp dụng · {activeFilterCount(filters)}</T><T style={{ color: colors.muted, fontSize: 12 }}>{filters.amenities.join(' · ') || 'Chọn bộ lọc phù hợp'}</T></Card>
    <SectionTitle title="Gợi ý cho chuyến đi của bạn" />
    <HotelCard hotel={HOTELS[0]} />
  </TravelerScaffold>;
}

function DestinationScreen() {
  const destination = useTravelerStore((state) => state.destination);
  const setSearch = useTravelerStore((state) => state.setSearch);
  const [query, setQuery] = useState(destination);
  const suggestions = ['Đà Nẵng', 'Hội An', 'Nha Trang', 'Phú Quốc', 'Hà Nội'].filter((item) => item.toLocaleLowerCase('vi-VN').includes(query.toLocaleLowerCase('vi-VN')));
  return <TravelerScaffold title="Chọn điểm đến" back footer={<Button label="Tìm khách sạn" onPress={() => { setSearch({ destination: query.trim() || destination }); go('results'); }} />}>
    <Field label="Điểm đến, ngày và khách" onChangeText={setQuery} placeholder="Bạn muốn đi đâu?" value={query} />
    <Card><T weight="semibold">Bộ lọc đang áp dụng</T><T style={{ color: colors.muted }}>Gần biển · Hồ bơi · Hủy miễn phí</T></Card>
    <SectionTitle title="Điểm đến gợi ý" />
    {suggestions.map((item) => <Card key={item} onPress={() => { setQuery(item); setSearch({ destination: item }); }}><T weight="semibold">{item}</T></Card>)}
    <HotelCard hotel={HOTELS[0]} />
  </TravelerScaffold>;
}

function DatesScreen() {
  const { checkIn, checkOut, setSearch } = useTravelerStore();
  const [start, setStart] = useState(checkIn);
  const [end, setEnd] = useState(checkOut);
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [month, setMonth] = useState(checkIn.slice(0, 7));
  const [error, setError] = useState('');
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  const leading = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const moveMonth = (offset: number) => {
    const next = new Date(year, monthNumber - 1 + offset, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };
  const selectDay = (day: number) => {
    const value = `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (value < new Date().toISOString().slice(0, 10)) return setError('Vui lòng chọn ngày từ hôm nay trở đi.');
    setError('');
    if (!choosingEnd || value <= start) { setStart(value); setEnd(value); setChoosingEnd(true); }
    else { setEnd(value); setChoosingEnd(false); }
  };
  return <TravelerScaffold title="Chọn ngày lưu trú" back footer={<Button label="Tìm khách sạn" onPress={() => { if (end <= start || start < new Date().toISOString().slice(0, 10)) return setError('Chọn ngày trả phòng sau ngày nhận phòng.'); setSearch({ checkIn: start, checkOut: end }); go('results'); }} />}>
    <Card><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Pressable accessibilityLabel="Tháng trước" onPress={() => moveMonth(-1)} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}><T style={{ fontSize: 22 }}>‹</T></Pressable><T weight="semibold" style={{ fontSize: 16 }}>Tháng {monthNumber} / {year}</T><Pressable accessibilityLabel="Tháng sau" onPress={() => moveMonth(1)} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' }}><T style={{ fontSize: 22 }}>›</T></Pressable></View><View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <T key={day} style={{ color: colors.muted, fontSize: 12 }}>{day}</T>)}</View></Card>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{Array.from({ length: leading + days }, (_, index) => index < leading ? <View key={`empty-${index}`} style={{ width: '14.28%', height: 46 }} /> : <Pressable accessibilityLabel={`Ngày ${index - leading + 1}`} key={index} onPress={() => selectDay(index - leading + 1)} style={{ width: '14.28%', height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: `${year}-${String(monthNumber).padStart(2, '0')}-${String(index - leading + 1).padStart(2, '0')}` >= start && `${year}-${String(monthNumber).padStart(2, '0')}-${String(index - leading + 1).padStart(2, '0')}` <= end ? colors.primaryLight : colors.white }}><T weight="semibold" style={{ color: colors.ink }}>{index - leading + 1}</T></Pressable>)}</View>
    {error ? <T accessibilityRole="alert" style={{ color: colors.error }}>{error}</T> : null}
    <Card><T weight="semibold">Ngày lưu trú</T><T style={{ color: colors.muted }}>Nhận phòng {dateLabel(start)} · Trả phòng {dateLabel(end)} · {nights(start, end)} đêm</T></Card>
  </TravelerScaffold>;
}

function GuestsScreen() {
  const { adults, children, rooms, setSearch } = useTravelerStore();
  const counter = (label: string, value: number, min: number, key: 'adults' | 'children' | 'rooms') => <Card><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><T style={{ color: colors.gray }}>{label}</T><View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}><Pressable accessibilityLabel={`Giảm ${label}`} onPress={() => setSearch({ [key]: Math.max(min, value - 1) })}><T weight="bold" style={{ fontSize: 20 }}>−</T></Pressable><T weight="semibold">{value}</T><Pressable accessibilityLabel={`Tăng ${label}`} onPress={() => setSearch({ [key]: Math.min(10, value + 1) })}><T weight="bold" style={{ fontSize: 20 }}>+</T></Pressable></View></View></Card>;
  return <TravelerScaffold title="Số khách và phòng" back>{counter('Người lớn', adults, 1, 'adults')}{counter('Trẻ em', children, 0, 'children')}{counter('Số phòng', rooms, 1, 'rooms')}<Button label="Tìm khách sạn" onPress={() => go('results')} /></TravelerScaffold>;
}

function ResultsScreen() {
  const { destination, filters, sort, compare, resetFilters, setFilters } = useTravelerStore();
  const results = getResults(destination, filters, sort);
  const active = [
    ...(filters.minPrice > 0 || filters.maxPrice < 5000000 ? [{ label: `${Math.round(filters.minPrice / 1000)}K–${Math.round(filters.maxPrice / 1000000 * 10) / 10}M`, clear: () => setFilters({ minPrice: 0, maxPrice: 5000000 }) }] : []),
    ...(filters.stars.length ? [{ label: `${filters.stars.join('–')} sao`, clear: () => setFilters({ stars: [] }) }] : []),
    ...filters.amenities.map((amenity) => ({ label: amenity, clear: () => setFilters({ amenities: filters.amenities.filter((item) => item !== amenity) }) })),
    ...(filters.freeCancellation ? [{ label: 'Miễn phí hủy', clear: () => setFilters({ freeCancellation: false }) }] : []),
    ...(!(filters.types.length === 1 && filters.types[0] === 'HOTEL') ? filters.types.map((type) => ({ label: ACCOMMODATION_LABELS[type], clear: () => setFilters({ types: filters.types.filter((item) => item !== type) }) })) : []),
  ];
  return <TravelerScaffold title="Kết quả tìm kiếm" back background={colors.white}>
    <StaySummary onPress={() => go('destination')} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}><Chip label={`Bộ lọc · ${activeFilterCount(filters)}`} selected={active.length > 0} onPress={() => go('filters')} /><Chip label={SORT_OPTIONS.find((item) => item.value === sort)?.label ?? 'Sắp xếp'} onPress={() => go('sort')} /><Chip label="Bản đồ" onPress={() => go('map')} /></ScrollView>
    {active.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{active.map((item) => <Chip key={item.label} label={`${item.label}  ×`} selected onPress={item.clear} small />)}</ScrollView> : null}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T weight="semibold" style={{ fontSize: 14 }}>{results.length} chỗ nghỉ phù hợp</T><Pressable onPress={resetFilters}><T weight="semibold" style={{ color: colors.primaryDark, fontSize: 13 }}>Xóa tất cả</T></Pressable></View>
    {results.length ? results.map((hotel) => <HotelCard hotel={hotel} key={hotel.id} showActions />) : <EmptyState action="Điều chỉnh bộ lọc" detail="Thử nới khoảng giá hoặc chọn khu vực khác." onPress={() => go('filters')} title="Không tìm thấy khách sạn phù hợp" />}
    {compare.length >= 2 ? <Button label={`So sánh ${compare.length} khách sạn`} onPress={() => go('compare')} /> : null}
  </TravelerScaffold>;
}

function FilterScreen() {
  const { destination, filters, setFilters, resetFilters, sort } = useTravelerStore();
  const [minInput, setMinInput] = useState(String(filters.minPrice));
  const [maxInput, setMaxInput] = useState(String(filters.maxPrice));
  const [error, setError] = useState('');
  const count = getResults(destination, filters, sort).length;
  const parsePrice = (value: string) => Number(value.replace(/\D/g, ''));
  const updatePrice = (min: number, max: number) => { setMinInput(String(min)); setMaxInput(String(max)); setFilters({ minPrice: min, maxPrice: max }); setError(''); };
  const preset = (label: string, min: number, max: number) => <Chip key={label} label={label} selected={filters.minPrice === min && filters.maxPrice === max} onPress={() => { setFilters({ minPrice: min, maxPrice: max }); setMinInput(String(min)); setMaxInput(String(max)); setError(''); }} />;
  const toggleType = (type: AccommodationType) => setFilters({ types: filters.types.includes(type) ? filters.types.filter((item) => item !== type) : [...filters.types, type] });
  const toggleAmenity = (amenity: Amenity) => setFilters({ amenities: filters.amenities.includes(amenity) ? filters.amenities.filter((item) => item !== amenity) : [...filters.amenities, amenity] });
  const reset = () => { resetFilters(); setMinInput('0'); setMaxInput('5000000'); setError(''); };
  return <TravelerScaffold title="Bộ lọc" back headerRight={<Pressable onPress={reset}><T weight="semibold" style={{ color: colors.primary }}>Đặt lại</T></Pressable>} footer={<View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Button label="Đặt lại" secondary onPress={reset} /></View><View style={{ flex: 2 }}><Button label={`Xem ${count} chỗ nghỉ`} onPress={() => { const min = parsePrice(minInput); const max = parsePrice(maxInput); if (min > max || max <= 0) { setError('Khoảng giá không hợp lệ.'); return; } setFilters({ minPrice: min, maxPrice: max }); go('results'); }} /></View></View>}>
    <SectionTitle title="Khoảng giá mỗi đêm" /><T style={{ color: colors.muted }}>Chọn ngân sách phù hợp cho mỗi đêm</T>
    <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Field keyboardType="numeric" label="Giá từ" onChangeText={(value) => { setMinInput(value); const min = parsePrice(value); if (min <= filters.maxPrice) setFilters({ minPrice: min }); }} value={minInput} /></View><View style={{ flex: 1 }}><Field keyboardType="numeric" label="Giá đến" onChangeText={(value) => { setMaxInput(value); const max = parsePrice(value); if (max >= filters.minPrice) setFilters({ maxPrice: max }); }} value={maxInput} /></View></View>
    {error ? <T style={{ color: colors.error }}>{error}</T> : null}
    <PriceRangeSlider min={filters.minPrice} max={filters.maxPrice} onChange={updatePrice} /><T style={{ textAlign: 'center', color: colors.muted, fontSize: 12 }}>{currency(filters.minPrice)} — {currency(filters.maxPrice)} / đêm</T>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{preset('Dưới 500K', 0, 500000)}{preset('500K–1M', 500000, 1000000)}{preset('1M–2M', 1000000, 2000000)}{preset('2M–3M', 2000000, 3000000)}{preset('Trên 3M', 3000000, 5000000)}</View>
    <SectionTitle title="Hạng khách sạn" /><T style={{ color: colors.muted, fontSize: 12 }}>Chọn nhiều hạng sao</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[1, 2, 3, 4, 5].map((star) => <Chip key={star} label={`${star} ★`} selected={filters.stars.includes(star)} onPress={() => setFilters({ stars: filters.stars.includes(star) ? filters.stars.filter((value) => value !== star) : [...filters.stars, star] })} />)}</View>
    <SectionTitle title="Điểm đánh giá của khách" /><T style={{ color: colors.muted, fontSize: 12 }}>Từ mức điểm bạn mong muốn</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[{ label: '9+ Tuyệt vời', value: 9 }, { label: '8+ Rất tốt', value: 8 }, { label: '7+ Tốt', value: 7 }, { label: '6+ Khá', value: 6 }].map((item) => <Chip key={item.value} label={item.label} selected={filters.minRating === item.value} onPress={() => setFilters({ minRating: filters.minRating === item.value ? 0 : item.value })} />)}</View>
    <SectionTitle title="Loại chỗ ở" action="Xem tất cả" onPress={() => go('accommodation')} /><TypeGrid selected={filters.types} toggle={toggleType} preview />
    <SectionTitle title="Tiện ích" action="Xem tất cả" onPress={() => go('amenities')} /><AmenityChips selected={filters.amenities} toggle={toggleAmenity} />
    <Chip label="Hủy miễn phí" selected={filters.freeCancellation} onPress={() => setFilters({ freeCancellation: !filters.freeCancellation })} />
  </TravelerScaffold>;
}

function SortScreen() {
  const current = useTravelerStore((state) => state.sort);
  const setSort = useTravelerStore((state) => state.setSort);
  const [selected, setSelected] = useState(current);
  return <TravelerScaffold title="Sắp xếp theo" back footer={<Button label="Áp dụng" onPress={() => { setSort(selected); go('results'); }} />}>
    <T style={{ color: colors.muted, marginBottom: 16 }}>Chọn một cách sắp xếp kết quả</T>
    {SORT_OPTIONS.map((option) => <Pressable key={option.value} onPress={() => setSelected(option.value)} style={{ borderWidth: 1, borderColor: selected === option.value ? colors.primary : colors.line, borderRadius: 12, minHeight: 60, padding: 14, backgroundColor: selected === option.value ? colors.primaryLight : colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flex: 1 }}><T style={{ color: selected === option.value ? colors.primary : colors.ink }}>{option.label}</T>{option.detail ? <T style={{ color: colors.muted, fontSize: 12 }}>{option.detail}</T> : null}</View><T style={{ color: selected === option.value ? colors.primary : '#9CA3AF', fontSize: 24 }}>{selected === option.value ? '●' : '○'}</T></Pressable>)}
  </TravelerScaffold>;
}

function AccommodationScreen() {
  const { filters, setFilters, destination, sort } = useTravelerStore();
  const toggle = (type: AccommodationType) => setFilters({ types: filters.types.includes(type) ? filters.types.filter((item) => item !== type) : [...filters.types, type] });
  return <TravelerScaffold title="Loại chỗ ở" back footer={<Button label={`Xem ${getResults(destination, filters, sort).length} chỗ nghỉ`} onPress={() => go('results')} />} headerRight={<Pressable onPress={() => go('search-entry')}><T weight="semibold" style={{ color: colors.primary }}>Đóng</T></Pressable>}>
    <Card style={{ backgroundColor: colors.primaryLight }}><T weight="semibold">Ở theo cách bạn thích</T><T style={{ color: colors.gray }}>Chọn nhiều loại chỗ ở để mở rộng kết quả phù hợp.</T></Card>
    <SectionTitle title="Loại chỗ ở" action={`${filters.types.length} đã chọn`} />
    <TypeGrid selected={filters.types} toggle={toggle} />
    <Card><T weight="semibold">Bạn có thể chọn nhiều loại</T><T style={{ color: colors.gray, fontSize: 12 }}>Ví dụ: Khách sạn và Resort sẽ cùng xuất hiện trong kết quả.</T></Card>
  </TravelerScaffold>;
}

function AmenitiesScreen() {
  const { filters, setFilters, destination, sort } = useTravelerStore();
  const [expanded, setExpanded] = useState(false);
  const toggle = (amenity: Amenity) => setFilters({ amenities: filters.amenities.includes(amenity) ? filters.amenities.filter((item) => item !== amenity) : [...filters.amenities, amenity] });
  return <TravelerScaffold title="Tiện ích" back footer={<Button label={`Xem ${getResults(destination, filters, sort).length} chỗ nghỉ`} onPress={() => go('results')} />} headerRight={<Pressable onPress={() => go('search-entry')}><T weight="semibold" style={{ color: colors.primary }}>Đóng</T></Pressable>}>
    <Card style={{ backgroundColor: colors.primaryLight }}><T weight="semibold">Một kỳ nghỉ đúng ý</T><T style={{ color: colors.gray }}>Chọn tiện ích nơi ở và trong phòng bạn quan tâm.</T></Card>
    <SectionTitle title="Tiện nghi chỗ ở" /><T style={{ color: colors.primary, fontSize: 12 }}>{filters.amenities.length} đã chọn</T>
    <AmenityChips selected={filters.amenities} toggle={toggle} limit={expanded ? 12 : 8} />
    <Pressable onPress={() => setExpanded(!expanded)}><T weight="semibold" style={{ color: colors.primary }}>{expanded ? 'Thu gọn' : 'Xem tất cả 12 tiện nghi ↓'}</T></Pressable>
    <SectionTitle title="Tiện nghi phòng" /><T style={{ color: colors.gray, fontSize: 12 }}>Những chi tiết nhỏ cho kỳ nghỉ thoải mái</T>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{ROOM_AMENITIES.map((item) => <Chip key={item} label={item} selected={filters.amenities.includes(item)} onPress={() => toggle(item)} />)}</View>
    <Card><T weight="semibold">Kết hợp nhiều tiện ích</T><T style={{ color: colors.gray, fontSize: 12 }}>Chỉ hiển thị nơi ở đáp ứng tất cả lựa chọn của bạn.</T></Card>
  </TravelerScaffold>;
}

function MapScreen() {
  const { destination, filters, sort } = useTravelerStore();
  const hotels = getResults(destination, filters, sort);
  const [selected, setSelected] = useState(hotels.some((item) => item.id === 'blue-horizon') ? 'blue-horizon' : hotels[0]?.id ?? 'blue-horizon');
  const hotel = hotels.find((item) => item.id === selected) ?? hotels[0];
  return <TravelerScaffold title="Tìm trên bản đồ" back scroll={false} background={colors.white}>
    <View style={{ flex: 1, margin: -16, backgroundColor: '#EAF1EC', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '25%', backgroundColor: '#B9DEE9' }} />
      {[20, 42, 68, 88].map((top) => <View key={top} style={{ position: 'absolute', top: `${top}%`, left: 0, width: '77%', height: 9, backgroundColor: colors.white, transform: [{ rotate: '-3deg' }] }} />)}
      {[10, 37, 67].map((left) => <View key={left} style={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: 9, backgroundColor: colors.white, transform: [{ rotate: '7deg' }] }} />)}
      <T weight="semibold" style={{ position: 'absolute', top: '28%', left: '28%', color: colors.muted, fontSize: 12 }}>SƠN TRÀ</T>
      <T weight="semibold" style={{ position: 'absolute', top: '32%', right: 12, color: colors.primaryDark, fontSize: 12, transform: [{ rotate: '-90deg' }] }}>BIỂN MỸ KHÊ</T>
      <View style={{ padding: 16, gap: 8 }}><Card style={{ borderRadius: 30, alignItems: 'center', elevation: 4 }}><T weight="semibold" style={{ fontSize: 13 }}>{destination} · 12–15 thg 10</T></Card><View style={{ flexDirection: 'row', gap: 8 }}><Chip label={`Bộ lọc · ${activeFilterCount(filters)}`} onPress={() => go('filters')} /><Chip label="Tìm ở khu vực này" onPress={() => setSelected(hotels[0]?.id ?? selected)} /></View></View>
      {hotels.map((item, index) => <Pressable key={item.id} onPress={() => setSelected(item.id)} style={{ position: 'absolute', top: `${42 + index * 14}%`, left: `${20 + index * 18}%`, backgroundColor: selected === item.id ? colors.primaryDark : colors.white, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, elevation: 4 }}><T weight="semibold" style={{ color: selected === item.id ? colors.white : colors.ink }}>{(item.price / 1000000).toFixed(2).replace('.', ',')} triệu</T></Pressable>)}
      {hotel ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 12 }}><Pressable onPress={() => { useTravelerStore.getState().selectHotel(hotel.id); go('hotel-detail', { hotelId: hotel.id }); }} style={{ flexDirection: 'row', gap: 12 }}><Image source={hotel.image} style={{ width: 96, height: 84, borderRadius: 12 }} /><View style={{ flex: 1, gap: 4 }}><T weight="semibold">{hotel.name}</T><T style={{ color: colors.muted, fontSize: 12 }}>★ {hotel.rating} · {hotel.distance}</T><T weight="bold" style={{ color: colors.primaryDark }}>{currency(hotel.price)} / đêm</T></View></Pressable><Button label="Xem danh sách" onPress={() => go('results')} /></View> : null}
    </View>
  </TravelerScaffold>;
}

export function SearchScreen({ id }: { id: SearchScreenId }) {
  if (id === 'search-entry') return <SearchEntryScreen />;
  if (id === 'destination') return <DestinationScreen />;
  if (id === 'dates') return <DatesScreen />;
  if (id === 'guests') return <GuestsScreen />;
  if (id === 'results') return <ResultsScreen />;
  if (id === 'filters') return <FilterScreen />;
  if (id === 'sort') return <SortScreen />;
  if (id === 'accommodation') return <AccommodationScreen />;
  if (id === 'amenities') return <AmenitiesScreen />;
  if (id === 'map' || id === 'map-preview') return <MapScreen />;
  return <TravelerScaffold title="Không có kết quả" back><EmptyState action="Điều chỉnh bộ lọc" detail="Thử nới khoảng giá hoặc chọn khu vực khác." onPress={() => go('filters')} title="Không tìm thấy khách sạn phù hợp" /></TravelerScaffold>;
}
