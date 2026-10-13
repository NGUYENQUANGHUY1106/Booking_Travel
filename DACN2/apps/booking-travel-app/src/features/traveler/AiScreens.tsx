import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { suggestHotel } from './ai-demo';
import { HOTELS, currency, nights } from './data';
import { useTravelerStore } from './store';
import { colors } from './theme';
import { Button, Card, EmptyState, Field, HotelCard, T, TravelerScaffold, go } from './ui';

export type AiScreenId = 'ai-home' | 'ai-search' | 'ai-compare' | 'ai-review-summary' | 'travel-planner' | 'travel-plan-result' | 'budget-planner' | 'smart-packing' | 'price-insight' | 'ai-history' | 'ai-unavailable';

function AiCard({ title, detail, onPress }: { title: string; detail: string; onPress?: () => void }) {
  return <Card onPress={onPress} style={{ backgroundColor: colors.violetLight, padding: 14, gap: 8 }}><T weight="semibold">{title}</T><T style={{ color: colors.muted, lineHeight: 20 }}>{detail}</T></Card>;
}

function AiHomeScreen() {
  const prompts = ['Đi Đà Nẵng 3 ngày gần biển', 'Khách sạn có hồ bơi dưới 1,5 triệu', 'So sánh hai khách sạn'];
  return <TravelerScaffold title="Trợ lý du lịch" back><Card><T weight="semibold">Bạn muốn đi đâu?</T><T style={{ color: colors.muted, lineHeight: 20 }}>Kể cho mình điểm đến, thời gian, số khách và ngân sách. Gợi ý sẽ dựa trên khách sạn có dữ liệu.</T></Card>{prompts.map((prompt) => <AiCard key={prompt} detail="Chạm để bắt đầu trò chuyện" onPress={() => go('ai-search', { prompt })} title={prompt} />)}<Button label="Bắt đầu hỏi AI" violet onPress={() => go('ai-search')} /><Button label="Kế hoạch chuyến đi" secondary onPress={() => go('travel-planner')} /><Button label="Lịch sử trò chuyện" secondary onPress={() => go('ai-history')} /></TravelerScaffold>;
}

function AiSearchScreen() {
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const messages = useTravelerStore((state) => state.aiMessages);
  const addAiMessage = useTravelerStore((state) => state.addAiMessage);
  const selectHotel = useTravelerStore((state) => state.selectHotel);
  const destination = useTravelerStore((state) => state.destination);
  const selectedHotelId = useTravelerStore((state) => state.selectedHotelId);
  const [query, setQuery] = useState(typeof prompt === 'string' ? prompt : '');
  const [noMatch, setNoMatch] = useState(false);
  const ask = () => {
    if (!query.trim()) return;
    addAiMessage(query.trim(), true);
    const hotel = suggestHotel(HOTELS, query, destination);
    setNoMatch(!hotel);
    if (hotel) {
      addAiMessage(`${hotel.name} phù hợp với yêu cầu của bạn: ${hotel.distance}, điểm ${hotel.rating}/10, giá từ ${currency(hotel.price)}/đêm. Kiểm tra giá và phòng khi đặt.`, false);
      selectHotel(hotel.id);
    } else addAiMessage('Chưa có khách sạn mẫu phù hợp với điểm đến, ngân sách và tiện ích này. Hãy thử nới điều kiện tìm kiếm.', false);
    setQuery('');
  };
  return <TravelerScaffold title="Tìm khách sạn cùng AI" back><AiCard detail="Tôi đi Đà Nẵng 3 ngày với bạn gái, ngân sách khoảng 1,5 triệu/đêm, muốn gần biển và có hồ bơi." title="Bạn" /><AiCard detail="Blue Horizon My Khe phù hợp 94%: cách biển 350 m, có hồ bơi, điểm 9.1/10, từ 1.450.000 ₫/đêm." title="Gợi ý demo · Dựa trên dữ liệu khách sạn" />
    {messages.map((message) => <Card key={message.id} style={{ backgroundColor: message.mine ? '#DCEAFF' : colors.violetLight }}><T weight="semibold">{message.mine ? 'Bạn' : 'Gợi ý demo'}</T><T style={{ color: colors.gray }}>{message.text}</T></Card>)}
    {noMatch ? <EmptyState action="Tìm bằng bộ lọc" detail="Chưa có dữ liệu mẫu phù hợp với yêu cầu vừa nhập." onPress={() => go('search-entry')} title="Chưa tìm thấy gợi ý" /> : <AiCard detail="Gợi ý dựa trên khách sạn có trong dữ liệu mẫu" onPress={() => go('ai-compare')} title={HOTELS.find((hotel) => hotel.id === selectedHotelId)?.name ?? 'Khách sạn phù hợp'} />}
    <Field label="Hỏi thêm" onChangeText={setQuery} placeholder="Bạn muốn tìm nơi ở như thế nào?" value={query} /><Button label="Gửi câu hỏi" violet onPress={ask} /><Button label="Xem khách sạn" secondary onPress={() => go('hotel-detail')} />
    <T style={{ color: colors.orange, fontSize: 12 }}>AI đang mô phỏng. Giá và tình trạng phòng chưa được xác nhận.</T>
  </TravelerScaffold>;
}

function AiCompareScreen() {
  const selectedHotelId = useTravelerStore((state) => state.selectedHotelId);
  const hotel = HOTELS.find((item) => item.id === selectedHotelId) ?? HOTELS[0];
  return <TravelerScaffold title="So sánh gợi ý" back><AiCard detail={`${hotel.distance} · ${hotel.amenities[0]} · ${hotel.rating}/10`} title={hotel.name} /><AiCard detail={`Điểm ${hotel.rating}/10 từ ${hotel.reviews} đánh giá mẫu, giá từ ${currency(hotel.price)}/đêm. So sánh thêm để chọn nơi ở phù hợp.`} title="Vì sao phù hợp?" /><HotelCard hotel={hotel} /><Button label="So sánh chi tiết" violet onPress={() => go('compare')} /><Button label="Xem khách sạn" secondary onPress={() => go('hotel-detail')} /></TravelerScaffold>;
}

function AiReviewSummaryScreen() {
  const selectedHotelId = useTravelerStore((state) => state.selectedHotelId);
  const hotel = HOTELS.find((item) => item.id === selectedHotelId) ?? HOTELS[0];
  return <TravelerScaffold title="Tóm tắt đánh giá" back><AiCard detail={`${hotel.name} · ${hotel.reviews} lượt đánh giá trong dữ liệu mẫu`} title={`Điểm ${hotel.rating}/10`} /><Card><T weight="semibold">Nguồn đánh giá</T><T style={{ color: colors.muted }}>Đây là dữ liệu mẫu của khách sạn. Bản demo chưa phân tích văn bản đánh giá từ khách thật.</T></Card></TravelerScaffold>;
}

function TravelPlannerScreen() {
  const { destination, checkIn, checkOut, adults, profile } = useTravelerStore();
  const setTravelPlanCreated = useTravelerStore((state) => state.setTravelPlanCreated);
  return <TravelerScaffold title="Lên kế hoạch chuyến đi" back><Card><T weight="semibold">Thông tin chuyến đi</T><T style={{ color: colors.muted }}>{destination} · {checkIn}–{checkOut} · {adults} người lớn · {nights(checkIn, checkOut)} đêm</T></Card><Card><T weight="semibold">Sở thích</T><T style={{ color: colors.muted }}>{profile.preferences.join(', ') || 'Biển, ẩm thực địa phương, di chuyển thuận tiện'}</T></Card><Button label="Tạo lịch trình" violet onPress={() => { setTravelPlanCreated(true); go('travel-plan-result'); }} /></TravelerScaffold>;
}

function TravelPlanResultScreen() {
  const destination = useTravelerStore((state) => state.destination);
  const hotel = HOTELS.find((item) => item.destination === destination);
  return <TravelerScaffold title="Lịch trình gợi ý" back><AiCard title="Kế hoạch 3 ngày" detail={`${destination} · ${hotel ? `nghỉ tại ${hotel.name}` : 'chưa có khách sạn mẫu'} · lịch trình tham khảo`} />{[`Ngày 1 · Đến ${destination} và nhận phòng`, `Ngày 2 · Khám phá ${destination} và ẩm thực địa phương`, 'Ngày 3 · Thư giãn, trả phòng'].map((item) => <Card key={item}><T weight="semibold">{item}</T><T style={{ color: colors.muted }}>Bạn có thể điều chỉnh theo giờ mở cửa và thời tiết thực tế.</T></Card>)}<Button label="Xem dự toán chi phí" violet onPress={() => go('budget-planner')} /></TravelerScaffold>;
}

function BudgetPlannerScreen() {
  const { checkIn, checkOut, selectedHotelId, adults, rooms, destination, tripBudget, setTripBudget } = useTravelerStore();
  const [budgetInput, setBudgetInput] = useState(String(tripBudget));
  const hotel = HOTELS.find((item) => item.id === selectedHotelId && item.destination === destination) ?? HOTELS.find((item) => item.destination === destination);
  const stay = (hotel?.price ?? 0) * nights(checkIn, checkOut) * rooms;
  const food = 1200000;
  const travel = 600000;
  const total = stay + food + travel;
  const parsedBudget = Number(budgetInput.replace(/[^0-9]/g, ''));
  return <TravelerScaffold title="Dự toán chi phí" back><Field label="Ngân sách chuyến đi (VND)" keyboardType="numeric" onChangeText={setBudgetInput} value={budgetInput} /><Button label="Lưu ngân sách" secondary disabled={!Number.isFinite(parsedBudget) || parsedBudget <= 0} onPress={() => setTripBudget(parsedBudget)} /><Card><T weight="semibold">Ngân sách đã lưu: {currency(tripBudget)}</T><T style={{ color: colors.muted }}>Lưu trú {hotel ? currency(stay) : 'chưa có dữ liệu'} · Ăn uống {currency(food)} · Di chuyển {currency(travel)}</T></Card><AiCard title="Tổng dự kiến" detail={`${currency(total)} cho ${adults} người / ${nights(checkIn, checkOut)} ngày${hotel ? '' : ' · chưa gồm chi phí khách sạn'}`} /><AiCard title="So với ngân sách" detail={total <= tripBudget ? `Còn khoảng ${currency(tripBudget - total)} trong ngân sách.` : `Vượt khoảng ${currency(total - tripBudget)}. Bạn có thể điều chỉnh khách sạn hoặc số đêm.`} /><T style={{ color: colors.orange, fontSize: 12 }}>Chi phí demo, không phải báo giá thanh toán.</T></TravelerScaffold>;
}

function SmartPackingScreen() {
  const { packingItems, addPackingItem, togglePackingItem, removePackingItem } = useTravelerStore();
  const [newItem, setNewItem] = useState('');
  const add = () => { if (newItem.trim()) { addPackingItem(newItem.trim()); setNewItem(''); } };
  return <TravelerScaffold title="Danh sách hành lý" back><Field label="Thêm đồ cần mang" onChangeText={setNewItem} onSubmitEditing={add} placeholder="Ví dụ: kính râm" value={newItem} /><Button label="Thêm vào danh sách" disabled={!newItem.trim()} onPress={add} />{packingItems.map((item) => <Card key={item.id}><Card onPress={() => togglePackingItem(item.id)} style={{ padding: 0 }}><T weight="semibold">{item.checked ? '☑' : '☐'} {item.label}</T><T style={{ color: colors.muted }}>Chạm để đánh dấu đã chuẩn bị</T></Card><Button label="Xóa" secondary compact onPress={() => removePackingItem(item.id)} /></Card>)}</TravelerScaffold>;
}

function PriceInsightScreen() {
  const selectedHotelId = useTravelerStore((state) => state.selectedHotelId);
  const hotel = HOTELS.find((item) => item.id === selectedHotelId) ?? HOTELS[0];
  return <TravelerScaffold title="Thông tin giá" back><AiCard title="Gợi ý giá demo" detail={`${currency(hotel.price)}/đêm nằm trong ngân sách dự kiến. Giá thực tế và phòng trống phải được kiểm tra lại khi đặt.`} /><HotelCard hotel={hotel} /></TravelerScaffold>;
}

function AiHistoryScreen() {
  const messages = useTravelerStore((state) => state.aiMessages);
  const travelPlanCreated = useTravelerStore((state) => state.travelPlanCreated);
  const destination = useTravelerStore((state) => state.destination);
  return <TravelerScaffold title="Lịch sử trò chuyện" back>{messages.length ? <Card onPress={() => go('ai-search')}><T weight="semibold">Cuộc trò chuyện gần đây</T><T style={{ color: colors.muted }}>{[...messages].reverse().find((message) => message.mine)?.text}</T></Card> : null}{travelPlanCreated ? <Card onPress={() => go('travel-plan-result')}><T weight="semibold">Kế hoạch {destination}</T><T style={{ color: colors.muted }}>Lịch trình demo đã lưu</T></Card> : null}{!messages.length && !travelPlanCreated ? <EmptyState title="Chưa có lịch sử" detail="Hãy hỏi trợ lý hoặc tạo lịch trình để lưu tại đây." action="Bắt đầu hỏi" onPress={() => go('ai-search')} /> : null}</TravelerScaffold>;
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
  return <TravelerScaffold title="Trợ lý tạm ngưng" back><EmptyState action="Thử lại" detail="Bạn vẫn có thể tìm khách sạn bằng bộ lọc thông thường." onPress={() => go('search-entry')} title="Trợ lý chưa khả dụng" /></TravelerScaffold>;
}
