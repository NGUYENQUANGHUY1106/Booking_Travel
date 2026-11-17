import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { currency, nights } from './data';
import { publicHotelPrice } from './hotel-discovery';
import { PublicHotelCard } from './PublicHotelCard';
import { usePublicHotelDiscovery, type PublicHotel } from './public-hotels';
import { useTravelerStore } from './store';
import { colors } from './theme';
import { Button, Card, EmptyState, Field, T, TravelerScaffold, go } from './ui';

export type AiScreenId = 'ai-home' | 'ai-search' | 'ai-compare' | 'ai-review-summary' | 'travel-planner' | 'travel-plan-result' | 'budget-planner' | 'smart-packing' | 'price-insight' | 'ai-history' | 'ai-unavailable';

function AiCard({ title, detail, onPress }: { title: string; detail: string; onPress?: () => void }) {
  return <Card onPress={onPress} style={{ backgroundColor: colors.violetLight, padding: 14, gap: 8 }}><T weight="semibold">{title}</T><T style={{ color: colors.muted, lineHeight: 20 }}>{detail}</T></Card>;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi-VN');
}

function matchHotel(hotels: PublicHotel[], query: string, destination: string) {
  const terms = normalize(`${query} ${destination}`).split(/\s+/).filter((term) => term.length > 2);
  return hotels.find((hotel) => {
    const source = normalize([hotel.name, hotel.addressLine, hotel.city, hotel.province, ...hotel.amenities.map((item) => item.name)].filter(Boolean).join(' '));
    return terms.some((term) => source.includes(term));
  }) ?? hotels[0];
}

function useSelectedDatabaseHotel() {
  const selectedHotelId = useTravelerStore((state) => state.selectedHotelId);
  const hotels = usePublicHotelDiscovery();
  return { ...hotels, hotel: hotels.data?.find((item) => item.id === selectedHotelId) ?? hotels.data?.[0] };
}

function DatabaseHotelState({ hotel, pending, error }: { hotel?: PublicHotel; pending: boolean; error: boolean }) {
  if (pending) return <Card><T>Đang tải khách sạn từ hệ thống...</T></Card>;
  if (error) return <EmptyState title="Không tải được khách sạn" detail="Hãy kiểm tra backend và kết nối mạng." action="Tìm bằng bộ lọc" onPress={() => go('search-entry')} />;
  if (!hotel) return <EmptyState title="Chưa có khách sạn công khai" detail="Chỉ khách sạn tồn tại trong cơ sở dữ liệu mới được hiển thị." action="Xem danh sách" onPress={() => go('results')} />;
  return <PublicHotelCard hotel={hotel} />;
}

function AiHomeScreen() {
  const prompts = ['Đi Đà Nẵng 3 ngày gần biển', 'Khách sạn có hồ bơi dưới 1,5 triệu', 'So sánh khách sạn đang mở bán'];
  return <TravelerScaffold title="Trợ lý du lịch" back><Card><T weight="semibold">Bạn muốn đi đâu?</T><T style={{ color: colors.muted }}>Gợi ý chỉ sử dụng khách sạn công khai đang có trong cơ sở dữ liệu.</T></Card>{prompts.map((prompt) => <AiCard key={prompt} detail="Chạm để bắt đầu" onPress={() => go('ai-search', { prompt })} title={prompt} />)}<Button label="Bắt đầu hỏi AI" violet onPress={() => go('ai-search')} /><Button label="Kế hoạch chuyến đi" secondary onPress={() => go('travel-planner')} /></TravelerScaffold>;
}

function AiSearchScreen() {
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const state = useTravelerStore();
  const hotels = usePublicHotelDiscovery();
  const [query, setQuery] = useState(typeof prompt === 'string' ? prompt : '');
  const [suggestedId, setSuggestedId] = useState<string>();
  const suggested = hotels.data?.find((hotel) => hotel.id === suggestedId) ?? hotels.data?.find((hotel) => hotel.id === state.selectedHotelId) ?? hotels.data?.[0];
  const ask = () => {
    if (!query.trim() || !hotels.data?.length) return;
    state.addAiMessage(query.trim(), true);
    const hotel = matchHotel(hotels.data, query, state.destination);
    state.addAiMessage(`${hotel.name} phù hợp nhất trong dữ liệu hiện có. Hãy mở chi tiết để kiểm tra giá và phòng trống theo ngày.`, false);
    state.selectHotel(hotel.id);
    setSuggestedId(hotel.id);
    setQuery('');
  };
  return <TravelerScaffold title="Tìm khách sạn cùng AI" back>
    {state.aiMessages.map((message) => <Card key={message.id} style={{ backgroundColor: message.mine ? '#DCEAFF' : colors.violetLight }}><T weight="semibold">{message.mine ? 'Bạn' : 'Gợi ý từ dữ liệu hệ thống'}</T><T>{message.text}</T></Card>)}
    <DatabaseHotelState hotel={suggested} pending={hotels.isPending} error={hotels.isError} />
    <Field label="Hỏi thêm" onChangeText={setQuery} placeholder="Bạn muốn tìm nơi ở như thế nào?" value={query} />
    <Button label="Gửi câu hỏi" violet disabled={!query.trim() || !hotels.data?.length} onPress={ask} />
  </TravelerScaffold>;
}

function AiCompareScreen() {
  const hotels = useSelectedDatabaseHotel();
  const hotel = hotels.hotel;
  return <TravelerScaffold title="So sánh gợi ý" back><DatabaseHotelState hotel={hotel} pending={hotels.isPending} error={hotels.isError} />{hotel ? <AiCard title="Vì sao phù hợp?" detail={`${hotel.starRating || 'Chưa có'} sao · ${hotel.roomCount} hạng phòng · ${hotel.amenities.slice(0, 3).map((item) => item.name).join(', ') || 'Chưa cập nhật tiện nghi'}`} /> : null}<Button label="Xem danh sách so sánh" violet onPress={() => go('compare')} /></TravelerScaffold>;
}

function AiReviewSummaryScreen() {
  const hotels = useSelectedDatabaseHotel();
  const hotel = hotels.hotel;
  return <TravelerScaffold title="Tóm tắt đánh giá" back><DatabaseHotelState hotel={hotel} pending={hotels.isPending} error={hotels.isError} />{hotel ? <Card><T weight="semibold">Nguồn đánh giá</T><T style={{ color: colors.muted }}>{hotel.reviewCount ? `${hotel.reviewCount} đánh giá đã được ghi nhận.` : 'Khách sạn này chưa có đánh giá thực tế trong cơ sở dữ liệu.'}</T></Card> : null}</TravelerScaffold>;
}

function TravelPlannerScreen() {
  const { destination, checkIn, checkOut, adults, profile } = useTravelerStore();
  const setTravelPlanCreated = useTravelerStore((state) => state.setTravelPlanCreated);
  return <TravelerScaffold title="Lên kế hoạch chuyến đi" back><Card><T weight="semibold">Thông tin chuyến đi</T><T style={{ color: colors.muted }}>{destination} · {checkIn}–{checkOut} · {adults} người lớn · {nights(checkIn, checkOut)} đêm</T></Card><Card><T weight="semibold">Sở thích</T><T style={{ color: colors.muted }}>{profile.preferences.join(', ') || 'Chưa thiết lập'}</T></Card><Button label="Tạo lịch trình" violet onPress={() => { setTravelPlanCreated(true); go('travel-plan-result'); }} /></TravelerScaffold>;
}

function TravelPlanResultScreen() {
  const destination = useTravelerStore((state) => state.destination);
  const hotels = useSelectedDatabaseHotel();
  return <TravelerScaffold title="Lịch trình gợi ý" back><AiCard title="Kế hoạch 3 ngày" detail={`${destination} · ${hotels.hotel ? `nghỉ tại ${hotels.hotel.name}` : 'chưa chọn khách sạn trong hệ thống'}`} />{hotels.hotel ? <PublicHotelCard hotel={hotels.hotel} /> : null}<Button label="Xem dự toán chi phí" violet onPress={() => go('budget-planner')} /></TravelerScaffold>;
}

function BudgetPlannerScreen() {
  const { checkIn, checkOut, adults, rooms, tripBudget, setTripBudget } = useTravelerStore();
  const hotels = useSelectedDatabaseHotel();
  const [budgetInput, setBudgetInput] = useState(String(tripBudget));
  const price = hotels.hotel ? publicHotelPrice(hotels.hotel) ?? 0 : 0;
  const stay = price * nights(checkIn, checkOut) * rooms;
  const total = stay + 1_800_000;
  const parsed = Number(budgetInput.replace(/[^0-9]/g, ''));
  return <TravelerScaffold title="Dự toán chi phí" back><Field label="Ngân sách chuyến đi (VND)" keyboardType="numeric" onChangeText={setBudgetInput} value={budgetInput} /><Button label="Lưu ngân sách" secondary disabled={!Number.isFinite(parsed) || parsed <= 0} onPress={() => setTripBudget(parsed)} /><Card><T weight="semibold">Lưu trú từ dữ liệu hiện tại: {price ? currency(stay) : 'chưa có giá'}</T><T>{adults} khách · {rooms} phòng</T></Card><AiCard title="Tổng dự kiến" detail={currency(total)} /></TravelerScaffold>;
}

function SmartPackingScreen() {
  const { packingItems, addPackingItem, togglePackingItem, removePackingItem } = useTravelerStore();
  const [newItem, setNewItem] = useState('');
  const add = () => { if (newItem.trim()) { addPackingItem(newItem.trim()); setNewItem(''); } };
  return <TravelerScaffold title="Danh sách hành lý" back><Field label="Thêm đồ cần mang" onChangeText={setNewItem} value={newItem} /><Button label="Thêm" disabled={!newItem.trim()} onPress={add} />{packingItems.map((item) => <Card key={item.id} onPress={() => togglePackingItem(item.id)}><T>{item.checked ? '☑' : '☐'} {item.label}</T><Button compact secondary label="Xóa" onPress={() => removePackingItem(item.id)} /></Card>)}</TravelerScaffold>;
}

function PriceInsightScreen() {
  const hotels = useSelectedDatabaseHotel();
  const hotel = hotels.hotel;
  return <TravelerScaffold title="Thông tin giá" back><DatabaseHotelState hotel={hotel} pending={hotels.isPending} error={hotels.isError} />{hotel ? <AiCard title="Giá từ cơ sở dữ liệu" detail={publicHotelPrice(hotel) ? `${currency(publicHotelPrice(hotel)!)} / đêm` : 'Khách sạn chưa công bố giá phòng.'} /> : null}</TravelerScaffold>;
}

function AiHistoryScreen() {
  const messages = useTravelerStore((state) => state.aiMessages);
  return <TravelerScaffold title="Lịch sử trò chuyện" back>{messages.length ? messages.map((message) => <Card key={message.id}><T weight="semibold">{message.mine ? 'Bạn' : 'Gợi ý'}</T><T>{message.text}</T></Card>) : <EmptyState title="Chưa có lịch sử" detail="Hãy hỏi trợ lý để bắt đầu." action="Bắt đầu hỏi" onPress={() => go('ai-search')} />}</TravelerScaffold>;
}

export function AiScreen({ id }: { id: AiScreenId }) {
  if (id === 'ai-home') return <AiHomeScreen />;
  if (id === 'ai-search') return <AiSearchScreen />;
  if (id === 'ai-compare') return <AiCompareScreen />;
  if (id === 'ai-review-summary') return <AiReviewSummaryScreen />;
  if (id === 'travel-planner') return <TravelPlannerScreen />;
  if (id === 'travel-plan-result') return <TravelPlanResultScreen />;
  if (id === 'budget-planner') return <BudgetPlannerScreen />;
  if (id === 'smart-packing') return <SmartPackingScreen />;
  if (id === 'price-insight') return <PriceInsightScreen />;
  if (id === 'ai-history') return <AiHistoryScreen />;
  return <TravelerScaffold title="Trợ lý tạm ngưng" back><EmptyState action="Tìm khách sạn" detail="Bạn vẫn có thể tìm trong dữ liệu hệ thống." onPress={() => go('search-entry')} title="Trợ lý chưa khả dụng" /></TravelerScaffold>;
}
