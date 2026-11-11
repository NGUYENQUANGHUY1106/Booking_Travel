import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useTravelerStore } from "@/features/traveler/store";
import { InfoCard, OwnerButton, OwnerScaffold } from "../components/owner-ui";
import { ownerColors } from "../styles/tokens";
import { useOwnerHotels } from "../hotels/api";
import { useOwnerRooms } from "../hotels/room-api";
import {
  inventoryApi,
  useInventoryMonth,
  type InventoryBlock,
} from "../hotels/inventory-api";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const fmt = (date: string) => date.slice(8, 10) + "/" + date.slice(5, 7);
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const todayInVietnam = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const nextDate = (date: string) =>
  dateOnly(new Date(Date.parse(date + "T00:00:00Z") + 86_400_000));
const requestKey = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
const href = (id: string, hotelId: string, roomId: string, date: string) =>
  ({
    pathname: "/hotel-owner/screen/[id]",
    params: { id, hotelId, roomId, date },
  }) as never;

type SheetMode = "block" | "override" | "edit";

export function OwnerInventoryScreen({
  variant = "calendar",
}: {
  variant?: "calendar" | "booked" | "blocked" | "block";
}) {
  const params = useLocalSearchParams<{
    hotelId?: string;
    roomId?: string;
    date?: string;
  }>();
  const session = useTravelerStore((state) => state.session);
  const userId =
    session?.mode === "api" && session.role === "HOTEL_OWNER"
      ? session.userId
      : undefined;
  const hotels = useOwnerHotels(userId);
  const [chosenHotel, setChosenHotel] = useState<string>();
  const hotelId = hotels.data
    ? [chosenHotel, params.hotelId].find((id) => hotels.data.some((hotel) => hotel.id === id)) ?? (hotels.data.length === 1 ? hotels.data[0].id : undefined)
    : undefined;
  const rooms = useOwnerRooms(userId, hotelId);
  const [chosenRoom, setChosenRoom] = useState<string>();
  const roomId = rooms.data
    ? [chosenRoom, hotelId === params.hotelId ? params.roomId : undefined].find((id) => rooms.data.some((room) => room.id === id)) ?? (rooms.data.length === 1 ? rooms.data[0].id : undefined)
    : undefined;
  const [month, setMonth] = useState(() =>
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date.slice(0, 7)
      : todayInVietnam().slice(0, 7),
  );
  const [start, setStart] = useState<string | undefined>(params.date);
  const [end, setEnd] = useState<string | undefined>();
  const [sheet, setSheet] = useState<SheetMode | null>(
    variant === "block" ? "block" : null,
  );
  const [editing, setEditing] = useState<InventoryBlock | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("Bảo trì");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const keyRef = useRef(requestKey());
  const releaseKeys = useRef(new Map<string, string>());
  const client = useQueryClient();
  const inventory = useInventoryMonth(userId, hotelId, roomId, month);

  const refetchInventory = inventory.refetch;
  useFocusEffect(
    useCallback(() => {
      if (roomId) void refetchInventory();
    }, [roomId, refetchInventory]),
  );

  const selectedDays = useMemo(
    () =>
      inventory.data?.days.filter(
        (day) => start && day.date >= start && day.date <= (end ?? start),
      ) ?? [],
    [inventory.data, start, end],
  );
  const day = inventory.data?.days.find((item) => item.date === start);
  const selectedBlocks =
    inventory.data?.blocks.filter(
      (item) =>
        day &&
        item.startDate.slice(0, 10) <= day.date &&
        day.date < item.endDateExclusive.slice(0, 10),
    ) ?? [];
  const selectedBookings =
    inventory.data?.bookings.filter(
      (item) =>
        day &&
        item.checkIn.slice(0, 10) <= day.date &&
        day.date < item.checkOut.slice(0, 10),
    ) ?? [];
  const today = todayInVietnam();

  function selectDate(date: string) {
    setNotice("");
    if (variant === "booked" || variant === "blocked") { setStart(date); setEnd(undefined); return; }
    if (!start || end || date < start) {
      setStart(date);
      setEnd(undefined);
    } else if (date === start) setEnd(undefined);
    else setEnd(date);
  }

  function openSheet(mode: SheetMode, block?: InventoryBlock) {
    if (!start && !block) return;
    setEditing(block ?? null);
    setSheet(mode);
    setFormStart(block?.startDate.slice(0, 10) ?? start!);
    setFormEnd(block?.endDateExclusive.slice(0, 10) ?? nextDate(end ?? start!));
    setQuantity(
      String(
        block?.quantity ??
          (mode === "override" ? (inventory.data?.totalRooms ?? 0) : 1),
      ),
    );
    setReason(block?.reason ?? "Bảo trì");
    setError("");
    keyRef.current = requestKey();
  }

  async function refresh() {
    if (!userId || !hotelId || !roomId) return;
    await client.invalidateQueries({
      queryKey: ["owner-inventory", userId, hotelId, roomId],
    });
    await client.invalidateQueries({
      queryKey: ["owner-rooms", userId, hotelId],
    });
    await client.invalidateQueries({ queryKey: ["owner-dashboard", userId] });
    await client.invalidateQueries({
      queryKey: ["public-room-availability", roomId],
    });
    await client.invalidateQueries({ queryKey: ["public-hotels"] });
    await client.invalidateQueries({ queryKey: ["public-hotel-discovery"] });
    await inventory.refetch();
  }

  async function submit() {
    if (!hotelId || !roomId || !inventory.data || !sheet || busy) return;
    const count =
      quantity.trim() === "" && sheet === "override" ? null : Number(quantity);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(formStart) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(formEnd) ||
      formEnd <= formStart ||
      formStart < today
    ) {
      setError(
        "Chọn khoảng ngày hợp lệ từ hôm nay; ngày kết thúc không được tính.",
      );
      return;
    }
    if (
      count !== null &&
      (!Number.isInteger(count) || count < (sheet === "override" ? 0 : 1))
    ) {
      setError("Số phòng phải là số nguyên hợp lệ.");
      return;
    }
    if (sheet !== "override" && (!reason.trim() || reason.trim() === "Khác")) {
      setError("Nhập lý do chặn phòng cụ thể.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const common = {
        startDate: formStart,
        endDateExclusive: formEnd,
        expectedRevision: inventory.data.revision,
        idempotencyKey: keyRef.current,
      };
      if (sheet === "override")
        await inventoryApi.setOverride(hotelId, roomId, {
          ...common,
          sellableQty: count,
        });
      else if (sheet === "edit" && editing)
        await inventoryApi.updateBlock(hotelId, roomId, editing.id, {
          ...common,
          quantity: count!,
          reason: reason.trim(),
          expectedVersion: editing.version,
        });
      else
        await inventoryApi.createBlock(hotelId, roomId, {
          ...common,
          quantity: count!,
          reason: reason.trim(),
        });
      setSheet(null);
      setNotice("Đã cập nhật tồn phòng.");
      await refresh();
    } catch (cause) {
      const detail = isAxiosError(cause)
        ? (cause.response?.data as {
            message?: string;
            date?: string;
            availableQty?: number;
          })
        : undefined;
      setError(typeof detail?.message === "string" ? detail.message : "Không thể lưu. Kiểm tra kết nối và thử lại.");
      if (isAxiosError(cause) && cause.response?.status === 409)
        void inventory.refetch();
    } finally {
      setBusy(false);
    }
  }

  async function release(block: InventoryBlock) {
    if (!hotelId || !roomId || !inventory.data || busy) return;
    const key = releaseKeys.current.get(block.id) ?? requestKey();
    releaseKeys.current.set(block.id, key);
    setBusy(true);
    setError("");
    try {
      await inventoryApi.releaseBlock(hotelId, roomId, block.id, {
        expectedRevision: inventory.data.revision,
        expectedVersion: block.version,
        idempotencyKey: key,
      });
      releaseKeys.current.delete(block.id);
      setNotice("Đã bỏ chặn phòng.");
      await refresh();
    } catch (cause) {
      const message = isAxiosError(cause) ? (cause.response?.data as { message?: unknown })?.message : undefined;
      setError(typeof message === "string" ? message : "Không thể bỏ chặn.");
    } finally {
      setBusy(false);
    }
  }

  function confirmRelease(block: InventoryBlock) {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Bỏ chặn và mở lại số phòng này?")) void release(block);
      return;
    }
    Alert.alert("Bỏ chặn phòng", "Số phòng này sẽ được mở bán lại nếu khách sạn đang công khai.", [
      { text: "Hủy", style: "cancel" },
      { text: "Bỏ chặn", style: "destructive", onPress: () => void release(block) },
    ]);
  }

  function moveMonth(offset: number) {
    const [year, number] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year, number - 1 + offset, 1));
    setMonth(dateOnly(next).slice(0, 7));
    setStart(undefined);
    setEnd(undefined);
  }

  const title =
    variant === "booked"
      ? "Lịch phòng đã đặt"
      : variant === "blocked"
        ? "Lịch phòng bị chặn"
        : variant === "block"
          ? "Chặn phòng"
          : "Lịch phòng trống";
  if (!userId)
    return (
      <OwnerScaffold title={title}>
        <Text style={styles.muted}>
          Đăng nhập bằng tài khoản Chủ khách sạn để xem lịch phòng.
        </Text>
      </OwnerScaffold>
    );
  return (
    <OwnerScaffold
      title={title}
      testID="OWN-UI-15"
      onRefresh={() => void refresh()}
      refreshing={inventory.isRefetching}
    >
      {variant !== "calendar" && hotelId && roomId ? <OwnerButton label="‹ Về lịch phòng trống" secondary onPress={() => router.replace({ pathname: "/hotel-owner/availability", params: { hotelId, roomId, ...(day ? { date: day.date } : {}) } } as never)} /> : null}
      <OwnerButton
        label="‹ Chỗ ở của tôi"
        secondary
        onPress={() => router.push("/hotel-owner/hotels")}
      />
      {hotels.isPending ? <ActivityIndicator /> : null}
      {hotels.isError ? (
        <OwnerButton
          label="Thử tải khách sạn"
          onPress={() => void hotels.refetch()}
        />
      ) : null}
      {hotels.data?.length === 0 ? (
        <InfoCard>
          <Text style={styles.muted}>Bạn chưa có khách sạn.</Text>
        </InfoCard>
      ) : null}
      {!hotelId && hotels.data ? (
        <InfoCard>
          <Text style={styles.heading}>Chọn khách sạn</Text>
          {hotels.data.map((hotel) => (
            <OwnerButton
              key={hotel.id}
              label={hotel.name}
              secondary
              onPress={() => {
                setChosenHotel(hotel.id);
                setChosenRoom(undefined);
              }}
            />
          ))}
        </InfoCard>
      ) : null}
      {hotelId && hotels.data && hotels.data.length > 1 ? (
        <InfoCard>
          <Text style={styles.heading}>Khách sạn</Text>
          {hotels.data.map((hotel) => (
            <OwnerButton
              key={hotel.id}
              label={hotel.name + (hotel.id === hotelId ? " ✓" : "")}
              secondary
              onPress={() => {
                setChosenHotel(hotel.id);
                setChosenRoom(undefined);
                setStart(undefined);
                setEnd(undefined);
              }}
            />
          ))}
        </InfoCard>
      ) : null}
      {hotelId && rooms.isPending ? <ActivityIndicator /> : null}
      {rooms.isError ? (
        <OwnerButton
          label="Thử tải hạng phòng"
          onPress={() => void rooms.refetch()}
        />
      ) : null}
      {rooms.data?.length === 0 ? (
        <InfoCard>
          <Text style={styles.muted}>
            Chưa có hạng phòng. Hãy thêm hạng phòng trước.
          </Text>
        </InfoCard>
      ) : null}
      {hotelId && rooms.data && !roomId ? (
        <InfoCard>
          <Text style={styles.heading}>Chọn hạng phòng</Text>
          {rooms.data.map((room) => (
            <OwnerButton
              key={room.id}
              label={`${room.name} · ${room.quantity} phòng`}
              secondary
              onPress={() => setChosenRoom(room.id)}
            />
          ))}
        </InfoCard>
      ) : null}
      {roomId && rooms.data ? (
        <InfoCard>
          <Text style={styles.heading}>Hạng phòng</Text>
          {rooms.data.map((room) => (
            <Pressable
              key={room.id}
              accessibilityRole="button"
              onPress={() => {
                setChosenRoom(room.id);
                setStart(undefined);
                setEnd(undefined);
              }}
              style={[
                styles.roomChoice,
                room.id === roomId && styles.selectedChoice,
              ]}
            >
              <Text style={styles.roomText}>
                {room.name} · {room.quantity} phòng{" "}
                {room.id === roomId ? "✓" : ""}
              </Text>
            </Pressable>
          ))}
        </InfoCard>
      ) : null}
      {hotelId && roomId ? (
        <OwnerButton
          label="Lịch giá phòng của hạng phòng này"
          secondary
          onPress={() =>
            router.push({
              pathname: "/hotel-owner/pricing",
              params: { hotelId, roomId, date: start?.slice(0, 7) === month ? start : `${month}-01` },
            } as never)
          }
        />
      ) : null}
      {roomId ? (
        <View style={styles.monthRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tháng trước"
            onPress={() => moveMonth(-1)}
            style={styles.arrow}
          >
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>
            Tháng {Number(month.slice(5))}, {month.slice(0, 4)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tháng sau"
            onPress={() => moveMonth(1)}
            style={styles.arrow}
          >
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>
      ) : null}
      {inventory.isPending && roomId ? (
        <ActivityIndicator color={ownerColors.primary} />
      ) : null}
      {inventory.isError ? (
        <InfoCard>
          <Text style={styles.error}>
            Không tải được lịch phòng. Kiểm tra mạng rồi thử lại.
          </Text>
          <OwnerButton
            label="Thử lại"
            onPress={() => void inventory.refetch()}
          />
        </InfoCard>
      ) : null}
      {inventory.data ? (
        <>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((label) => (
              <Text key={label} style={styles.weekday}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {Array.from(
              {
                length:
                  (new Date(
                    inventory.data.days[0].date + "T00:00:00Z",
                  ).getUTCDay() +
                    6) %
                  7,
              },
              (_, index) => (
                <View key={`blank-${index}`} style={styles.cell} />
              ),
            )}
            {inventory.data.days.map((item) => {
              const selected = Boolean(
                start && item.date >= start && item.date <= (end ?? start),
              );
              return (
                <Pressable
                  key={item.date}
                  accessibilityRole="button"
                  accessibilityLabel={`${fmt(item.date)}: còn ${item.available}, đặt ${item.booked}, chặn ${item.blocked} phòng`}
                  onPress={() => selectDate(item.date)}
                  style={[
                    styles.cell,
                    styles.dayCell,
                    selected && styles.selectedCell,
                  ]}
                >
                  <Text
                    style={[styles.dayNumber, selected && styles.selectedText]}
                  >
                    {Number(item.date.slice(8))}
                  </Text>
                  <Text
                    style={[
                      styles.dayCount,
                      item.available === 0 && styles.error,
                    ]}
                  >
                    {item.available} trống
                  </Text>
                  <View style={styles.marks}>
                    {item.booked > 0 ? (
                      <View style={[styles.mark, styles.blue]} />
                    ) : null}
                    {item.blocked > 0 ? (
                      <View style={[styles.mark, styles.gray]} />
                    ) : null}
                    {item.available > 0 ? (
                      <View style={[styles.mark, styles.green]} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.legend}>
            <Legend color="#147A4F" text="Còn trống" />
            <Legend color="#175ED6" text="Đã đặt" />
            <Legend color="#64748B" text="Đã chặn" />
          </View>
          {selectedDays.length ? (
            <InfoCard style={styles.summary}>
              <Text style={styles.heading}>
                {fmt(selectedDays[0].date)}
                {selectedDays.length > 1
                  ? `–${fmt(selectedDays[selectedDays.length - 1].date)}`
                  : ""}{" "}
                · {inventory.data.roomName}
              </Text>
              <Text style={styles.muted}>
                Đêm đã chọn; ngày trả phòng{" "}
                {fmt(nextDate(selectedDays[selectedDays.length - 1].date))}{" "}
                không tính.
              </Text>
              <Text style={styles.muted}>
                Còn ít nhất{" "}
                {Math.min(...selectedDays.map((item) => item.available))} phòng
                · Đã đặt tối đa{" "}
                {Math.max(...selectedDays.map((item) => item.booked))} · Đã chặn
                tối đa {Math.max(...selectedDays.map((item) => item.blocked))}
              </Text>
              <Text style={styles.muted}>
                Sức chứa bán:{" "}
                {selectedDays.map((item) => item.effectiveCapacity).join(", ")}{" "}
                phòng theo từng đêm.
              </Text>
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <OwnerButton
                    label="Chặn ngày"
                    disabled={
                      selectedDays[0].date < today ||
                      Math.min(...selectedDays.map((item) => item.available)) <
                        1
                    }
                    onPress={() => openSheet("block")}
                  />
                </View>
                <View style={styles.flex}>
                  <OwnerButton
                    label="Điều chỉnh số bán"
                    secondary
                    disabled={selectedDays[0].date < today}
                    onPress={() => openSheet("override")}
                  />
                </View>
              </View>
            </InfoCard>
          ) : (
            <InfoCard>
              <Text style={styles.muted}>
                Chọn một ngày hoặc hai ngày để chọn khoảng đêm.
              </Text>
            </InfoCard>
          )}
          {day ? (
            <InfoCard>
              <Text style={styles.heading}>Chi tiết đêm {fmt(day.date)}</Text>
              <Text style={styles.muted}>
                Tổng {day.totalRooms} · Bán được {day.effectiveCapacity} · Đặt{" "}
                {day.booked} · Chặn {day.blocked} · Còn {day.available}
              </Text>
              {day.sellableOverride !== null ? (
                <OwnerButton
                  label="Bỏ giới hạn bán"
                  secondary
                  onPress={() => {
                    openSheet("override");
                    setFormStart(day.date);
                    setFormEnd(nextDate(day.date));
                    setQuantity("");
                  }}
                />
              ) : null}
              {day.booked > 0 ? (
                <OwnerButton
                  label="Xem phòng đã đặt"
                  secondary
                  onPress={() =>
                    router.push(
                      href("availability-booked", hotelId!, roomId!, day.date),
                    )
                  }
                />
              ) : null}
              {day.blocked > 0 ? (
                <OwnerButton
                  label="Xem phòng đã chặn"
                  secondary
                  onPress={() =>
                    router.push(
                      href("availability-blocked", hotelId!, roomId!, day.date),
                    )
                  }
                />
              ) : null}
            </InfoCard>
          ) : null}
          {variant === "booked" && day
            ? selectedBookings.map((booking) => (
                <InfoCard key={booking.id} style={styles.bookedCard}>
                  <Text style={styles.heading}>{booking.code}</Text>
                  <Text style={styles.muted}>
                    {fmt(booking.checkIn.slice(0, 10))} →{" "}
                    {fmt(booking.checkOut.slice(0, 10))} (trả phòng) ·{" "}
                    {booking.roomCount} phòng · {booking.status}
                  </Text>
                  <OwnerButton
                    label="Xem booking"
                    secondary
                    onPress={() =>
                      router.push({
                        pathname: "/hotel-owner/screen/[id]",
                        params: {
                          id: "booking-detail",
                          bookingId: booking.id,
                          hotelId,
                          roomId,
                        },
                      } as never)
                    }
                  />
                </InfoCard>
              ))
            : null}
          {variant === "blocked" && day
            ? selectedBlocks.map((block) => (
                <InfoCard key={block.id} style={styles.blockedCard}>
                  <Text style={styles.heading}>
                    Đã chặn {block.quantity} phòng
                  </Text>
                  <Text style={styles.muted}>
                    {fmt(block.startDate.slice(0, 10))} →{" "}
                    {fmt(block.endDateExclusive.slice(0, 10))} (không tính ngày
                    cuối) · {block.reason}
                  </Text>
                  <Text style={styles.small}>Mã: {block.id}</Text>
                  <View style={styles.actions}>
                    <View style={styles.flex}>
                      <OwnerButton
                        label="Cập nhật"
                        secondary
                        disabled={block.startDate.slice(0, 10) < today}
                        onPress={() => openSheet("edit", block)}
                      />
                    </View>
                    <View style={styles.flex}>
                      <OwnerButton
                        label="Bỏ chặn"
                        danger
                        disabled={busy || block.startDate.slice(0, 10) < today}
                        onPress={() => confirmRelease(block)}
                      />
                    </View>
                  </View>
                </InfoCard>
              ))
            : null}
        </>
      ) : null}
      {notice ? <Text style={styles.success}>{notice}</Text> : null}
      {error && !sheet ? <Text style={styles.error}>{error}</Text> : null}
      <Modal
        visible={Boolean(sheet)}
        transparent
        animationType="slide"
        onRequestClose={() => setSheet(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.overlay}
        >
          <View style={styles.sheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetContent}
            >
              <Text style={styles.sheetTitle}>
                {sheet === "override"
                  ? "Điều chỉnh số phòng bán"
                  : sheet === "edit"
                    ? "Cập nhật chặn phòng"
                    : "Chặn phòng"}
              </Text>
              <Text style={styles.muted}>
                {inventory.data?.roomName} · tổng {inventory.data?.totalRooms}{" "}
                phòng
              </Text>
              <Text style={styles.label}>Ngày bắt đầu (đêm đầu tiên)</Text>
              <TextInput
                style={styles.input}
                value={formStart}
                onChangeText={(value) => {
                  setFormStart(value);
                  keyRef.current = requestKey();
                }}
                placeholder="YYYY-MM-DD"
              />
              <Text style={styles.label}>
                Ngày kết thúc (không tính đêm này)
              </Text>
              <TextInput
                style={styles.input}
                value={formEnd}
                onChangeText={(value) => {
                  setFormEnd(value);
                  keyRef.current = requestKey();
                }}
                placeholder="YYYY-MM-DD"
              />
              <Text style={styles.label}>
                {sheet === "override"
                  ? "Số phòng cho phép bán mỗi đêm"
                  : "Số phòng chặn mỗi đêm"}
              </Text>
              {sheet === "block" && selectedDays.length ? <Text style={styles.small}>Có thể chặn tối đa {Math.min(...selectedDays.map((item) => item.available))} phòng theo lịch đang xem.</Text> : null}
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={(value) => {
                  setQuantity(value);
                  keyRef.current = requestKey();
                }}
                keyboardType="number-pad"
              />
              {sheet !== "override" ? (
                <>
                  <Text style={styles.label}>Lý do</Text>
                  <View style={styles.actions}>
                    {["Bảo trì", "Sử dụng riêng", "Khác"].map((option) => (
                      <Pressable
                        key={option}
                        style={[
                          styles.reasonChoice,
                          reason === option && styles.selectedChoice,
                        ]}
                        onPress={() => {
                          setReason(option);
                          keyRef.current = requestKey();
                        }}
                      >
                        <Text style={styles.small}>{option}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    style={styles.input}
                    value={reason}
                    onChangeText={(value) => {
                      setReason(value);
                      keyRef.current = requestKey();
                    }}
                    placeholder="Mô tả lý do"
                  />
                </>
              ) : null}
              <Text style={styles.muted}>
                Tác động: {formStart} đến trước {formEnd}. Tồn thực được kiểm
                tra lại khi xác nhận.
              </Text>
              {selectedDays.map((item) => (
                <Text key={item.date} style={styles.small}>
                  {fmt(item.date)} · hiện còn {item.available} phòng
                </Text>
              ))}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <OwnerButton
                label={busy ? "Đang lưu..." : "Xác nhận"}
                disabled={busy}
                onPress={() => void submit()}
              />
              <OwnerButton
                label="Đóng"
                secondary
                onPress={() => setSheet(null)}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </OwnerScaffold>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.mark, { backgroundColor: color }]} />
      <Text style={styles.small}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { color: ownerColors.mutedModern, fontSize: 14, lineHeight: 20 },
  heading: { color: ownerColors.textModern, fontSize: 17, fontWeight: "700" },
  small: { color: ownerColors.mutedModern, fontSize: 12 },
  error: { color: "#B91C1C", fontSize: 13 },
  success: { color: "#147A4F", fontSize: 14 },
  roomChoice: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D5E1EF",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  selectedChoice: {
    borderColor: ownerColors.modernPrimary,
    backgroundColor: "#E3F0FF",
  },
  roomText: { color: ownerColors.textModern, fontSize: 14 },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthTitle: {
    color: ownerColors.textModern,
    fontSize: 20,
    fontWeight: "700",
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { color: ownerColors.modernPrimary, fontSize: 30 },
  weekRow: { flexDirection: "row" },
  weekday: {
    width: "14.285%",
    textAlign: "center",
    color: ownerColors.mutedModern,
    fontSize: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.285%", aspectRatio: 0.85 },
  dayCell: {
    borderWidth: 1,
    borderColor: "#D7E2EF",
    borderRadius: 8,
    backgroundColor: "white",
    padding: 3,
    justifyContent: "space-between",
  },
  selectedCell: {
    borderWidth: 2,
    borderColor: ownerColors.modernPrimary,
    backgroundColor: "#E3F0FF",
  },
  dayNumber: { color: ownerColors.textModern, fontSize: 14, fontWeight: "700" },
  selectedText: { color: ownerColors.modernPrimary },
  dayCount: { color: "#147A4F", fontSize: 10 },
  marks: { flexDirection: "row", gap: 2 },
  mark: { width: 7, height: 4, borderRadius: 2 },
  blue: { backgroundColor: "#175ED6" },
  gray: { backgroundColor: "#64748B" },
  green: { backgroundColor: "#147A4F" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  summary: { backgroundColor: "#F2F7FF", gap: 8 },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  flex: { flex: 1, minWidth: 120 },
  bookedCard: { backgroundColor: "#EFF6FF", gap: 8 },
  blockedCard: { backgroundColor: "#FFF7DF", gap: 8 },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#0008" },
  sheet: {
    maxHeight: "88%",
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  sheetContent: { gap: 10, paddingBottom: 20 },
  sheetTitle: {
    color: ownerColors.textModern,
    fontSize: 22,
    fontWeight: "700",
  },
  label: { color: ownerColors.textModern, fontSize: 14, fontWeight: "600" },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#D5E1EF",
    borderRadius: 12,
    paddingHorizontal: 12,
    color: ownerColors.textModern,
  },
  reasonChoice: {
    borderWidth: 1,
    borderColor: "#D5E1EF",
    borderRadius: 9,
    padding: 8,
  },
});
