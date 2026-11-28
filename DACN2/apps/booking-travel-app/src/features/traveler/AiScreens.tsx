import { ReviewSummaryCard } from '@/features/ai-review-summary/ReviewSummaryCard';
import { useLocalSearchParams } from 'expo-router';
import { isAxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { AMENITIES, currency, nights } from './data';
import { publicHotelPrice } from './hotel-discovery';
import { PublicHotelCard } from './PublicHotelCard';
import { usePublicHotelDiscovery, useTravelAssistant, type PublicHotel } from './public-hotels';
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
  const { prompt, hotelId } = useLocalSearchParams<{ prompt?: string; hotelId?: string }>();
  const state = useTravelerStore();
  const assistant = useTravelAssistant();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const sendingRef = useRef(false);
  const mountedRef = useRef(true);
  const [query, setQuery] = useState(typeof prompt === 'string' ? prompt : '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [state.aiMessages.length, assistant.data, assistant.isPending]);

  const ask = async (retry = false) => {
    const question = (retry ? failedQuestion : query)?.trim();
    if (!question || sendingRef.current) return;
    sendingRef.current = true;
    setErrorMessage(null);
    assistant.reset();
    if (!retry) state.addAiMessage(question, true);
    try {
      const hasStay = validStayDates(state.checkIn, state.checkOut);
      const result = await assistant.mutateAsync({
        message: question,
        conversationId: state.aiConversationId || undefined,
        guestSessionId: state.aiGuestSessionId || undefined,
        consentToSave: state.aiConsentToSave,
        context: {
          destination: state.destination.trim() || undefined,
          checkIn: hasStay ? state.checkIn : undefined,
          checkOut: hasStay ? state.checkOut : undefined,
          adults: state.adults,
          children: state.children,
          rooms: state.rooms,
          hotelId: typeof hotelId === 'string' ? hotelId : undefined,
        },
      });
      if (!mountedRef.current) return;
      state.addAiMessage(result.answer, false);
      state.setAiConversation(result.conversationId, result.guestSessionId);
      if (result.intent?.destination) state.setSearch({ destination: result.intent.destination });
      if (result.intent?.adults || result.intent?.rooms) state.setSearch({ adults: result.intent.adults ?? state.adults, rooms: result.intent.rooms ?? state.rooms });
      if (result.intent && result.intent.confidence >= 0.5) state.setFilters({
        maxPrice: result.intent.maxPrice ?? state.filters.maxPrice,
        minPrice: result.intent.minPrice ?? state.filters.minPrice,
        stars: result.intent.stars,
        types: result.intent.propertyTypes,
        amenities: AMENITIES.filter((amenity) => result.intent?.amenities.includes(amenity)),
        freeCancellation: result.intent.freeCancellation,
      });
      setQuery('');
      setFailedQuestion(null);
    } catch (error) {
      if (!mountedRef.current) return;
      setFailedQuestion(question);
      setQuery(question);
      if (isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') setErrorMessage('Yêu cầu quá thời gian. Kiểm tra kết nối rồi thử lại.');
        else if (!error.response) setErrorMessage('Điện thoại không kết nối được API. Kiểm tra Wi-Fi, địa chỉ API và thử lại.');
        else if (error.response.status === 401 || error.response.status === 403) setErrorMessage('Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại hoặc dùng tìm kiếm thường.');
        else if (error.response.status === 404) { state.setAiConversation('', ''); setErrorMessage('Hội thoại đã hết hạn. Bấm Thử lại để bắt đầu cuộc trò chuyện mới.'); }
        else if (error.response.status === 400) setErrorMessage('Câu hỏi hoặc ngày tìm kiếm chưa hợp lệ. Hãy kiểm tra rồi gửi lại.');
        else if (error.response.status === 429) setErrorMessage('Bạn gửi quá nhiều yêu cầu. Hãy đợi một chút rồi thử lại.');
        else if (error.response.status === 503) setErrorMessage('Dịch vụ tìm kiếm khách sạn đang tạm gián đoạn. Hãy thử lại hoặc dùng bộ lọc thường.');
        else setErrorMessage('Máy chủ tìm kiếm đang gặp lỗi. Hãy thử lại hoặc dùng bộ lọc thường.');
      } else setErrorMessage('Không thể xử lý yêu cầu lúc này. Hãy thử lại.');
    } finally {
      sendingRef.current = false;
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
    <Button label="Gửi cho trợ lý" violet disabled={!query.trim() || assistant.isPending} onPress={() => void ask()} />
  </View>;

  return <TravelerScaffold title="Tìm khách sạn cùng AI" back footer={composer} scroll={false}>
    <View style={aiStyles.chatFrame}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={aiStyles.chatContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      >
        {!state.aiMessages.length ? <View style={aiStyles.welcome}>
          <T weight="semibold" style={aiStyles.welcomeTitle}>Xin chào, tôi có thể giúp bạn tìm chỗ ở</T>
          <T style={aiStyles.muted}>Kết quả chỉ lấy từ khách sạn công khai trong cơ sở dữ liệu.</T>
        </View> : null}

        {state.aiMessages.filter((message) => message.text !== 'Tìm kiếm thông minh đang gián đoạn. Bạn vẫn có thể dùng bộ lọc thông thường.').map((message) => <View key={message.id} style={[aiStyles.messageRow, message.mine && aiStyles.messageRowMine]}>
          <View style={[aiStyles.bubble, message.mine ? aiStyles.bubbleMine : aiStyles.bubbleAssistant]}>
            <T weight="semibold" style={[aiStyles.sender, message.mine && aiStyles.senderMine]}>{message.mine ? 'Bạn' : 'Trợ lý tìm kiếm'}</T>
            <T style={[aiStyles.messageText, message.mine && aiStyles.messageTextMine]}>{message.text}</T>
          </View>
        </View>)}

        {assistant.data?.chips.length ? <Card style={aiStyles.resultCard}><T weight="semibold">Trợ lý đã hiểu</T><View style={aiStyles.chips}>{assistant.data.chips.map((chip) => <T key={chip} style={aiStyles.chip}>{chip}</T>)}</View></Card> : null}
        {assistant.data?.status === 'NEEDS_CLARIFICATION' && assistant.data.destinationSuggestions.length ? <Card style={aiStyles.resultCard}><T weight="semibold">Chọn điểm đến</T><View style={aiStyles.chips}>{assistant.data.destinationSuggestions.map((destination) => <Button key={destination} compact secondary label={destination} onPress={() => { state.setSearch({ destination }); setQuery((value) => `${value.trim()} ${destination}`.trim()); }} />)}</View></Card> : null}
        {assistant.data?.missingFields.includes('checkIn') ? <Button label="Chọn ngày nhận và trả phòng" secondary onPress={() => go('dates', { returnTo: 'ai-search', prompt: state.aiMessages.filter((message) => message.mine).at(-1)?.text || query })} /> : null}
        {assistant.data?.items.map((hotel) => <PublicHotelCard key={hotel.id} hotel={hotel} />)}
        {assistant.data ? <T style={aiStyles.providerLabel}>{assistant.data.provider.mode === 'LLM' ? `AI: ${assistant.data.provider.model}` : assistant.data.provider.status === 'FALLBACK' ? 'Mô hình AI tạm gián đoạn; kết quả được kiểm tra bằng dữ liệu hệ thống.' : 'Chế độ tìm kiếm theo dữ liệu hệ thống (chưa cấu hình mô hình AI)'}</T> : null}
        {assistant.isPending ? <View style={aiStyles.messageRow}><View style={[aiStyles.bubble, aiStyles.bubbleAssistant, aiStyles.loadingBubble]}><ActivityIndicator color={colors.violet} /><T style={aiStyles.muted}>Đang phân tích và tìm trong dữ liệu...</T></View></View> : null}
        {errorMessage ? <Card style={aiStyles.errorCard}><T weight="semibold" style={{ color: colors.error }}>{errorMessage}</T><Button label="Thử lại" secondary disabled={assistant.isPending} onPress={() => void ask(true)} /><Button label="Dùng bộ lọc thông thường" secondary onPress={() => go('search-entry')} /></Card> : null}
        <Button label={state.aiConsentToSave ? '✓ Đang lưu hội thoại vào tài khoản' : 'Không lưu hội thoại vào tài khoản'} secondary disabled={state.session?.mode !== 'api'} onPress={() => state.setAiConsentToSave(!state.aiConsentToSave)} />
        <Button label="Dùng bộ lọc thông thường" secondary onPress={() => go('search-entry')} />
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
  errorCard: { gap: 8, borderWidth: 1, borderColor: colors.error },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.violetLight, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  composer: { gap: 8, paddingBottom: 14 },
  providerLabel: { color: colors.muted, fontSize: 11, textAlign: 'center' },
});

function AiCompareScreen() {
  const hotels = useSelectedDatabaseHotel();
  const hotel = hotels.hotel;
  return <TravelerScaffold title="So sánh gợi ý" back><DatabaseHotelState hotel={hotel} pending={hotels.isPending} error={hotels.isError} />{hotel ? <AiCard title="Vì sao phù hợp?" detail={`${hotel.starRating || 'Chưa có'} sao · ${hotel.roomCount} hạng phòng · ${hotel.amenities.slice(0, 3).map((item) => item.name).join(', ') || 'Chưa cập nhật tiện nghi'}`} /> : null}<Button label="Xem danh sách so sánh" violet onPress={() => go('compare')} /></TravelerScaffold>;
}

function AiReviewSummaryScreen() {
  const hotels = useSelectedDatabaseHotel();
  const hotel = hotels.hotel;
  return <TravelerScaffold title="Tóm tắt đánh giá" back><DatabaseHotelState hotel={hotel} pending={hotels.isPending} error={hotels.isError} />{hotel ? <ReviewSummaryCard hotelId={hotel.id} /> : null}</TravelerScaffold>;
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
