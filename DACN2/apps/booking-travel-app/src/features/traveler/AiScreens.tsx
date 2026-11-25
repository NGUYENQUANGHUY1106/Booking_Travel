import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { currency, nights } from './data';
import { publicHotelPrice } from './hotel-discovery';
import { PublicHotelCard } from './PublicHotelCard';
import { usePublicHotelDiscovery, useSmartHotelSearch, type PublicHotel } from './public-hotels';
import { validStayDates } from './stay-context';
import { useTravelerStore } from './store';
import { colors } from './theme';
import { Button, Card, EmptyState, Field, T, TravelerScaffold, go } from './ui';

export type AiScreenId = 'ai-home' | 'ai-search' | 'ai-compare' | 'ai-review-summary' | 'travel-planner' | 'travel-plan-result' | 'budget-planner' | 'smart-packing' | 'price-insight' | 'ai-history' | 'ai-unavailable';

function AiCard({ title, detail, onPress }: { title: string; detail: string; onPress?: () => void }) {
  return <Card onPress={onPress} style={{ backgroundColor: colors.violetLight, padding: 14, gap: 8 }}><T weight="semibold">{title}</T><T style={{ color: colors.muted, lineHeight: 20 }}>{detail}</T></Card>;
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
  const smartSearch = useSmartHotelSearch();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [query, setQuery] = useState(typeof prompt === 'string' ? prompt : '');

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [state.aiMessages.length, smartSearch.data, smartSearch.isPending]);

  const ask = async () => {
    const question = query.trim();
    if (!question || smartSearch.isPending) return;
    state.addAiMessage(question, true);
    try {
      const hasStay = validStayDates(state.checkIn, state.checkOut);
      const result = await smartSearch.mutateAsync({ query: question, destination: state.destination.trim() || undefined, checkIn: hasStay ? state.checkIn : undefined, checkOut: hasStay ? state.checkOut : undefined, adults: state.adults, children: state.children, rooms: state.rooms });
      state.addAiMessage(result.message, false);
      if (result.intent.destination) state.setSearch({ destination: result.intent.destination });
      setQuery('');
    } catch {
      state.addAiMessage('Tìm kiếm thông minh đang gián đoạn. Bạn vẫn có thể dùng bộ lọc thông thường.', false);
    }
  };

  const composer = <View style={aiStyles.composer}>
    <Field
      label="Hỏi AI"
      onChangeText={setQuery}
      onSubmitEditing={() => void ask()}
      placeholder="Ví dụ: Homestay ở Hội An có hồ bơi"
      returnKeyType="send"
      value={query}
    />
    <Button label="Tìm kiếm thông minh" violet disabled={!query.trim() || smartSearch.isPending} onPress={() => void ask()} />
    <Button label="Dùng bộ lọc thông thường" secondary onPress={() => go('search-entry')} />
  </View>;

  return <TravelerScaffold title="Tìm khách sạn cùng AI" back footer={composer} scroll={false}>
    <View style={aiStyles.chatFrame}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={aiStyles.chatContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!state.aiMessages.length ? <View style={aiStyles.welcome}>
          <T weight="semibold" style={aiStyles.welcomeTitle}>Xin chào, tôi có thể giúp bạn tìm chỗ ở</T>
          <T style={aiStyles.muted}>Kết quả chỉ lấy từ khách sạn công khai trong cơ sở dữ liệu.</T>
        </View> : null}

        {state.aiMessages.map((message) => <View key={message.id} style={[aiStyles.messageRow, message.mine && aiStyles.messageRowMine]}>
          <View style={[aiStyles.bubble, message.mine ? aiStyles.bubbleMine : aiStyles.bubbleAssistant]}>
            <T weight="semibold" style={[aiStyles.sender, message.mine && aiStyles.senderMine]}>{message.mine ? 'Bạn' : 'Trợ lý tìm kiếm'}</T>
            <T style={[aiStyles.messageText, message.mine && aiStyles.messageTextMine]}>{message.text}</T>
          </View>
        </View>)}

        {smartSearch.data?.chips.length ? <Card style={aiStyles.resultCard}><T weight="semibold">AI đã hiểu</T><View style={aiStyles.chips}>{smartSearch.data.chips.map((chip) => <T key={chip} style={aiStyles.chip}>{chip}</T>)}</View></Card> : null}
        {smartSearch.data?.status === 'NEEDS_DESTINATION' && smartSearch.data.destinationSuggestions.length ? <Card style={aiStyles.resultCard}><T weight="semibold">Chọn điểm đến</T><View style={aiStyles.chips}>{smartSearch.data.destinationSuggestions.map((destination) => <Button key={destination} compact secondary label={destination} onPress={() => { state.setSearch({ destination }); setQuery((value) => `${value.trim()} ${destination}`.trim()); }} />)}</View></Card> : null}
        {smartSearch.data?.items.map((hotel) => <PublicHotelCard key={hotel.id} hotel={hotel} />)}
        {smartSearch.isPending ? <View style={aiStyles.messageRow}><View style={[aiStyles.bubble, aiStyles.bubbleAssistant, aiStyles.loadingBubble]}><ActivityIndicator color={colors.violet} /><T style={aiStyles.muted}>Đang phân tích và tìm trong dữ liệu...</T></View></View> : null}
        {smartSearch.isError ? <EmptyState title="Không thể dùng tìm kiếm thông minh" detail="Hãy thử lại hoặc quay về bộ lọc tìm kiếm thông thường." action="Dùng bộ lọc" onPress={() => go('search-entry')} /> : null}
      </ScrollView>
    </View>
  </TravelerScaffold>;
}

const aiStyles = StyleSheet.create({
  chatFrame: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 18 },
  chatContent: { flexGrow: 1, padding: 12, gap: 12 },
  welcome: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  welcomeTitle: { fontSize: 17, textAlign: 'center' },
  muted: { color: colors.muted, lineHeight: 20, textAlign: 'center' },
  messageRow: { width: '100%', alignItems: 'flex-start' },
  messageRowMine: { alignItems: 'flex-end' },
  bubble: { maxWidth: '86%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  bubbleAssistant: { backgroundColor: colors.violetLight, borderBottomLeftRadius: 5 },
  sender: { fontSize: 12, color: colors.muted },
  senderMine: { color: '#DBEAFE' },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageTextMine: { color: colors.white },
  loadingBubble: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultCard: { gap: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.violetLight, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  composer: { gap: 8 },
});

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
