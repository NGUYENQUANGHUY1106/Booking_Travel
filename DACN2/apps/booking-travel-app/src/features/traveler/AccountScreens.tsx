import { router, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';

import {
  getProfileErrorMessage,
  profileApi,
  type ProfileGender,
  type UserProfile,
  useMyProfile,
  useUpdateMyProfile,
} from './profile-api';
import { useTravelerStore } from './store';
import { colors } from './theme';
import {
  type AccommodationPreferenceType,
  type TravelAmenityPreference,
  type TravelAreaPreference,
  type TravelPreferences,
  type TravelTripType,
  useResetTravelPreferences,
  useTravelPreferences,
  useUpdateTravelPreferences,
} from './travel-preferences-api';
import { Button, Card, Chip, Field, Row, T, TravelerScaffold, go } from './ui';

export type AccountScreenId = 'profile' | 'edit-profile' | 'travel-preferences' | 'language-currency' | 'loyalty' | 'settings' | 'logout-confirm';

const GENDER_OPTIONS: { label: string; value: ProfileGender }[] = [
  { label: "Nam", value: "MALE" },
  { label: "Nữ", value: "FEMALE" },
  { label: "Khác", value: "OTHER" },
  { label: "Không muốn trả lời", value: "PREFER_NOT_TO_SAY" },
];

function toLocalProfile(profile: UserProfile) {
  return {
    name: profile.fullName,
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    avatarUrl: profile.avatarUrl ?? "",
    dateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? "",
    gender: profile.gender,
    nationality: profile.nationality ?? "",
    address: profile.address ?? "",
    createdAt: profile.createdAt,
    emailVerified: Boolean(profile.emailVerifiedAt),
    phoneVerified: Boolean(profile.phoneVerifiedAt),
  };
}

function memberSince(createdAt: string) {
  if (!createdAt) return "Thành viên Booking Travel";
  const year = new Date(createdAt).getFullYear();
  return Number.isFinite(year)
    ? `Thành viên từ ${year}`
    : "Thành viên Booking Travel";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(-2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "BT"
  );
}

function ProfileAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string;
}) {
  if (avatarUrl) {
    return (
      <Image
        accessibilityLabel="Ảnh đại diện"
        source={{ uri: avatarUrl }}
        style={{ width: 64, height: 64, borderRadius: 32 }}
      />
    );
  }
  return (
    <View
      style={{
        width: 64,
        height: 64,
        backgroundColor: "#DCEAFF",
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <T weight="semibold" style={{ color: colors.primaryDark, fontSize: 20 }}>
        {initials(name)}
      </T>
    </View>
  );
}

function ProfileScreen() {
  const session = useTravelerStore((state) => state.session);
  const profile = useTravelerStore((state) => state.profile);
  const updateProfile = useTravelerStore((state) => state.updateProfile);
  const logout = useTravelerStore((state) => state.logout);
  const apiSession = session?.mode === "api";
  const profileQuery = useMyProfile(apiSession);
  const [showLogout, setShowLogout] = useState(false);
  useEffect(() => {
    if (profileQuery.data) updateProfile(toLocalProfile(profileQuery.data));
  }, [profileQuery.data, updateProfile]);

  const confirmLogout = () => {
    logout();
    setShowLogout(false);
    router.replace("/auth/login" as Href);
  };
  return (
    <TravelerScaffold title="Tài khoản">
      <Card
        style={{
          minHeight: 132,
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
        }}
      >
        <ProfileAvatar avatarUrl={profile.avatarUrl} name={profile.name} />
        <View style={{ flex: 1, gap: 4 }}>
          <T weight="semibold" style={{ fontSize: 16 }}>
            {profile.name}
          </T>
          <T style={{ color: colors.muted, fontSize: 12 }}>{profile.email}</T>
          <T style={{ color: colors.primary, fontSize: 12 }}>
            {memberSince(profile.createdAt)}
          </T>
        </View>
      </Card>
      {apiSession && profileQuery.isFetching ? (
        <Card>
          <T style={{ color: colors.muted }}>Đang tải hồ sơ từ máy chủ...</T>
        </Card>
      ) : null}
      {apiSession && profileQuery.isError ? (
        <Card>
          <T style={{ color: colors.error }}>
            {getProfileErrorMessage(profileQuery.error, "Không thể tải hồ sơ.")}
          </T>
          <Button
            compact
            label="Thử lại"
            secondary
            onPress={() => void profileQuery.refetch()}
          />
        </Card>
      ) : null}
      <Card style={{ padding: 0 }}>
        <T
          weight="semibold"
          style={{ color: colors.gray, margin: 14, marginBottom: 0 }}
        >
          Tài khoản
        </T>
        <Row label="Thông tin cá nhân" onPress={() => go("edit-profile")} />
        <Row
          label="Sở thích du lịch"
          onPress={() => go("travel-preferences")}
        />
        <Row
          label="Phương thức thanh toán"
          onPress={() => go("payment-method")}
        />
        <Row label="Bảo mật" onPress={() => go("settings")} />
      </Card>
      <Card style={{ padding: 0 }}>
        <T
          weight="semibold"
          style={{ color: colors.gray, margin: 14, marginBottom: 0 }}
        >
          Hoạt động
        </T>
        <Row label="Đặt phòng của tôi" onPress={() => go("my-bookings")} />
        <Row label="Khách sạn yêu thích" onPress={() => go("favorites")} />
        <Row label="Wishlist" onPress={() => go("wishlist")} />
        <Row label="Đánh giá của tôi" onPress={() => go("my-reviews")} />
        <Row label="Lịch sử tìm kiếm" onPress={() => go("results")} />
      </Card>
      <Card style={{ padding: 0 }}>
        <T
          weight="semibold"
          style={{ color: colors.gray, margin: 14, marginBottom: 0 }}
        >
          Cài đặt
        </T>
        <Row label="Thông báo" onPress={() => go("notification-preferences")} />
        <Row label="Ngôn ngữ" onPress={() => go("language-currency")} />
        <Row label="Tiền tệ" onPress={() => go("language-currency")} />
        <Row label="Quyền riêng tư" onPress={() => go("settings")} />
        <Row label="Trợ giúp & hỗ trợ" onPress={() => go("chat-list")} />
      </Card>
      <Card
        onPress={() =>
          router.push(
            (session?.mode === "api" && session.role === "HOTEL_OWNER"
              ? "/owner-application/role-switcher"
              : session?.role === "HOTEL_OWNER"
                ? "/hotel-owner"
                : "/owner-application") as Href,
          )
        }
        style={{ backgroundColor: colors.primaryLight }}
      >
        <T weight="semibold">
          {session?.role === "HOTEL_OWNER"
            ? "Chuyển vai trò"
            : "Trở thành chủ khách sạn"}
        </T>
        <T style={{ color: colors.muted }}>
          {session?.role === "HOTEL_OWNER"
            ? "Kiểm tra quyền và mở trang quản lý chỗ ở."
            : "Nộp hoặc theo dõi hồ sơ xác minh chủ khách sạn."}
        </T>
      </Card>
      <Button label="Đăng xuất" secondary onPress={() => setShowLogout(true)} />
      <Modal
        animationType="slide"
        onRequestClose={() => setShowLogout(false)}
        transparent
        visible={showLogout}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#11182780",
            justifyContent: "flex-end",
          }}
        >
          <Pressable onPress={() => setShowLogout(false)} style={{ flex: 1 }} />
          <View
            style={{
              backgroundColor: colors.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 16,
              paddingBottom: 32,
              gap: 14,
            }}
          >
            <View
              style={{
                width: 34,
                height: 4,
                backgroundColor: "#D1D5DB",
                borderRadius: 4,
                alignSelf: "center",
              }}
            />
            <T style={{ color: colors.error, fontSize: 26 }}>↪</T>
            <T weight="semibold" style={{ fontSize: 20 }}>
              Đăng xuất khỏi Booking Travel?
            </T>
            <T style={{ color: colors.muted, lineHeight: 20 }}>
              Bạn sẽ cần đăng nhập lại để quản lý đặt phòng và sử dụng các tính
              năng cá nhân.
            </T>
            <Pressable
              onPress={confirmLogout}
              style={{
                minHeight: 50,
                backgroundColor: "#B91C1C",
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T weight="semibold" style={{ color: colors.white }}>
                Đăng xuất
              </T>
            </Pressable>
            <Button
              label="Hủy"
              secondary
              onPress={() => setShowLogout(false)}
            />
          </View>
        </View>
      </Modal>
    </TravelerScaffold>
  );
}

function EditProfileScreen() {
  const session = useTravelerStore((state) => state.session);
  const profile = useTravelerStore((state) => state.profile);
  const update = useTravelerStore((state) => state.updateProfile);
  const mutation = useUpdateMyProfile();
  const apiSession = session?.mode === "api";
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth);
  const [gender, setGender] = useState<ProfileGender | null>(profile.gender);
  const [nationality, setNationality] = useState(profile.nationality);
  const [address, setAddress] = useState(profile.address);
  const [error, setError] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const preview = useMemo(
    () => ({ name: name.trim() || profile.name, avatarUrl: avatarUrl.trim() }),
    [avatarUrl, name, profile.name],
  );

  const pickAvatar = async () => {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Bạn cần cho phép truy cập thư viện ảnh để chọn avatar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;
    if (!apiSession) {
      setAvatarUrl(asset.uri);
      return;
    }

    setAvatarBusy(true);
    try {
      const publicUrl = await profileApi.uploadAvatarAsset(asset);
      setAvatarUrl(publicUrl);
    } catch (uploadError) {
      setError(
        getProfileErrorMessage(
          uploadError,
          uploadError instanceof Error
            ? uploadError.message
            : "Không thể tải ảnh đại diện.",
        ),
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const save = async () => {
    if (name.trim().length < 2)
      return setError("Họ tên phải có ít nhất 2 ký tự.");
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth))
      return setError("Ngày sinh phải có định dạng YYYY-MM-DD.");
    setError("");
    const patch = {
      name: name.trim(),
      phone: phone.trim(),
      avatarUrl: avatarUrl.trim(),
      dateOfBirth,
      gender,
      nationality: nationality.trim(),
      address: address.trim(),
    };
    if (!apiSession) {
      update(patch);
      router.back();
      return;
    }

    try {
      const saved = await mutation.mutateAsync({
        fullName: patch.name,
        phone: patch.phone || null,
        avatarUrl: patch.avatarUrl || null,
        dateOfBirth: patch.dateOfBirth || null,
        gender: patch.gender,
        nationality: patch.nationality || null,
        address: patch.address || null,
      });
      update(toLocalProfile(saved));
      router.back();
    } catch (requestError) {
      setError(
        getProfileErrorMessage(requestError, "Không thể cập nhật hồ sơ."),
      );
    }
  };

  return (
    <TravelerScaffold title="Chỉnh sửa hồ sơ" back>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <ProfileAvatar {...preview} />
        <View style={{ flex: 1 }}>
          <T weight="semibold">{preview.name}</T>
          <T style={{ color: colors.muted }}>{profile.email}</T>
        </View>
      </Card>
      <Field label="Họ và tên" onChangeText={setName} value={name} />
      <Field
        editable={false}
        keyboardType="email-address"
        label="Email đã xác minh"
        value={profile.email}
        style={{ backgroundColor: "#F3F4F6", color: colors.muted }}
      />
      <T style={{ color: colors.muted, fontSize: 12 }}>
        Email không đổi tại đây vì cần xác minh OTP riêng.
      </T>
      <Field
        keyboardType="phone-pad"
        label="Số điện thoại"
        onChangeText={setPhone}
        value={phone}
      />
      <Field
        label="Ngày sinh (YYYY-MM-DD)"
        onChangeText={setDateOfBirth}
        placeholder="2000-01-31"
        value={dateOfBirth}
      />
      <T weight="semibold" style={{ color: colors.gray }}>
        Giới tính
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {GENDER_OPTIONS.map((item) => (
          <Chip
            key={item.value}
            label={item.label}
            selected={gender === item.value}
            onPress={() => setGender(item.value)}
          />
        ))}
      </View>
      <Field
        label="Quốc tịch"
        onChangeText={setNationality}
        placeholder="Việt Nam"
        value={nationality}
      />
      <Field
        label="Địa chỉ"
        multiline
        onChangeText={setAddress}
        placeholder="Địa chỉ liên hệ"
        value={address}
      />
      <Button
        disabled={avatarBusy}
        label={avatarBusy ? "Đang tải ảnh..." : "Chọn ảnh đại diện"}
        secondary
        onPress={() => void pickAvatar()}
      />
      {phone !== profile.phone ? (
        <T style={{ color: colors.orange, fontSize: 12 }}>
          Số điện thoại mới sẽ được đánh dấu là chưa xác minh.
        </T>
      ) : null}
      {error ? (
        <T accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </T>
      ) : null}
      <Button
        disabled={mutation.isPending || avatarBusy}
        label={mutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
        onPress={() => void save()}
      />
    </TravelerScaffold>
  );
}

const ACCOMMODATION_OPTIONS: { label: string; value: AccommodationPreferenceType }[] = [
  { label: 'Khách sạn', value: 'HOTEL' }, { label: 'Resort', value: 'RESORT' }, { label: 'Villa', value: 'VILLA' },
  { label: 'Căn hộ', value: 'APARTMENT' }, { label: 'Homestay', value: 'HOMESTAY' }, { label: 'Hostel', value: 'HOSTEL' },
];
const TRIP_OPTIONS: { label: string; value: TravelTripType }[] = [
  { label: 'Một mình', value: 'SOLO' }, { label: 'Cặp đôi', value: 'COUPLE' }, { label: 'Gia đình', value: 'FAMILY' },
  { label: 'Bạn bè', value: 'FRIENDS' }, { label: 'Công tác', value: 'BUSINESS' }, { label: 'Nghỉ dưỡng', value: 'WELLNESS' },
];
const AMENITY_OPTIONS: { label: string; value: TravelAmenityPreference }[] = [
  { label: 'Wi-Fi', value: 'WIFI' }, { label: 'Bữa sáng', value: 'BREAKFAST' }, { label: 'Hồ bơi', value: 'POOL' },
  { label: 'Bãi đỗ xe', value: 'PARKING' }, { label: 'Spa', value: 'SPA' }, { label: 'Phòng gym', value: 'GYM' },
  { label: 'Bãi biển', value: 'BEACH' }, { label: 'Đưa đón sân bay', value: 'AIRPORT_SHUTTLE' },
  { label: 'Cho phép thú cưng', value: 'PET_FRIENDLY' }, { label: 'Phòng gia đình', value: 'FAMILY_ROOM' },
];
const AREA_OPTIONS: { label: string; value: TravelAreaPreference }[] = [
  { label: 'Sát biển', value: 'BEACHFRONT' }, { label: 'Trung tâm', value: 'CITY_CENTER' }, { label: 'Yên tĩnh', value: 'QUIET' },
  { label: 'Gần sân bay', value: 'NEAR_AIRPORT' }, { label: 'Gần điểm tham quan', value: 'NEAR_ATTRACTIONS' },
  { label: 'Khu vui chơi đêm', value: 'NIGHTLIFE' }, { label: 'Văn hóa địa phương', value: 'LOCAL_CULTURE' }, { label: 'Gần thiên nhiên', value: 'NATURE' },
];

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function preferenceLabels(preferences: TravelPreferences) {
  const groups = [ACCOMMODATION_OPTIONS, TRIP_OPTIONS, AMENITY_OPTIONS, AREA_OPTIONS] as const;
  const selected = new Set<string>([
    ...preferences.accommodationTypes,
    ...preferences.tripTypes,
    ...preferences.preferredAmenities,
    ...preferences.preferredAreas,
  ]);
  return groups.flatMap((group) => group.filter((item) => selected.has(item.value)).map((item) => item.label));
}

const EMPTY_TRAVEL_PREFERENCES: TravelPreferences = {
  budgetMin: null,
  budgetMax: null,
  currency: 'VND',
  accommodationTypes: [],
  tripTypes: [],
  preferredAmenities: [],
  preferredAreas: [],
  updatedAt: null,
};

function TravelPreferencesEditor({ apiSession, initialPreferences }: { apiSession: boolean; initialPreferences: TravelPreferences }) {
  const profile = useTravelerStore((state) => state.profile);
  const updateProfile = useTravelerStore((state) => state.updateProfile);
  const updateMutation = useUpdateTravelPreferences();
  const resetMutation = useResetTravelPreferences();
  const [budgetMin, setBudgetMin] = useState(initialPreferences.budgetMin?.toString() ?? '');
  const [budgetMax, setBudgetMax] = useState(initialPreferences.budgetMax?.toString() ?? '');
  const [accommodationTypes, setAccommodationTypes] = useState(initialPreferences.accommodationTypes);
  const [tripTypes, setTripTypes] = useState(initialPreferences.tripTypes);
  const [preferredAmenities, setPreferredAmenities] = useState(initialPreferences.preferredAmenities);
  const [preferredAreas, setPreferredAreas] = useState(initialPreferences.preferredAreas);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const applyPreferences = (data: TravelPreferences) => {
    setBudgetMin(data.budgetMin?.toString() ?? '');
    setBudgetMax(data.budgetMax?.toString() ?? '');
    setAccommodationTypes(data.accommodationTypes);
    setTripTypes(data.tripTypes);
    setPreferredAmenities(data.preferredAmenities);
    setPreferredAreas(data.preferredAreas);
    updateProfile({ preferences: preferenceLabels(data) });
  };

  const save = async () => {
    const min = budgetMin.trim() ? Number(budgetMin) : null;
    const max = budgetMax.trim() ? Number(budgetMax) : null;
    if ((min !== null && !Number.isInteger(min)) || (max !== null && !Number.isInteger(max))) return setError('Ngân sách phải là số nguyên hợp lệ.');
    if (min !== null && max !== null && min > max) return setError('Ngân sách tối thiểu không được lớn hơn ngân sách tối đa.');
    const input = { budgetMin: min, budgetMax: max, currency: 'VND' as const, accommodationTypes, tripTypes, preferredAmenities, preferredAreas };
    setError('');
    setNotice('');
    if (!apiSession) {
      updateProfile({ preferences: preferenceLabels({ ...input, updatedAt: null }) });
      router.back();
      return;
    }
    try {
      const saved = await updateMutation.mutateAsync(input);
      updateProfile({ preferences: preferenceLabels(saved) });
      router.back();
    } catch (requestError) {
      setError(getProfileErrorMessage(requestError, 'Không thể lưu sở thích du lịch.'));
    }
  };

  const reset = async () => {
    setError('');
    if (!apiSession) {
      const empty = { budgetMin: null, budgetMax: null, currency: 'VND' as const, accommodationTypes: [], tripTypes: [], preferredAmenities: [], preferredAreas: [], updatedAt: null };
      applyPreferences(empty);
      setNotice('Đã đặt lại toàn bộ sở thích.');
      return;
    }
    try {
      const empty = await resetMutation.mutateAsync();
      applyPreferences(empty);
      setNotice('Đã đặt lại toàn bộ sở thích.');
    } catch (requestError) {
      setError(getProfileErrorMessage(requestError, 'Không thể đặt lại sở thích.'));
    }
  };

  const chips = <T style={{ color: colors.muted, fontSize: 12 }}>Các lựa chọn chỉ dùng để cải thiện gợi ý, không phải bộ lọc bắt buộc.</T>;
  return <TravelerScaffold title="Sở thích du lịch" back>
    <Card><T weight="semibold">{profile.name}</T><T style={{ color: colors.muted }}>{profile.email}</T></Card>
    <T weight="semibold">Khoảng ngân sách mỗi đêm</T>
    <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Field keyboardType="number-pad" label="Từ (VND)" onChangeText={setBudgetMin} placeholder="500000" value={budgetMin} /></View><View style={{ flex: 1 }}><Field keyboardType="number-pad" label="Đến (VND)" onChangeText={setBudgetMax} placeholder="3000000" value={budgetMax} /></View></View>
    <T weight="semibold">Loại chỗ ở</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{ACCOMMODATION_OPTIONS.map((item) => <Chip key={item.value} label={item.label} selected={accommodationTypes.includes(item.value)} onPress={() => setAccommodationTypes(toggleValue(accommodationTypes, item.value))} />)}</View>
    <T weight="semibold">Kiểu chuyến đi</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{TRIP_OPTIONS.map((item) => <Chip key={item.value} label={item.label} selected={tripTypes.includes(item.value)} onPress={() => setTripTypes(toggleValue(tripTypes, item.value))} />)}</View>
    <T weight="semibold">Tiện nghi ưu tiên</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{AMENITY_OPTIONS.map((item) => <Chip key={item.value} label={item.label} selected={preferredAmenities.includes(item.value)} onPress={() => setPreferredAmenities(toggleValue(preferredAmenities, item.value))} />)}</View>
    <T weight="semibold">Khu vực và đặc tính</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{AREA_OPTIONS.map((item) => <Chip key={item.value} label={item.label} selected={preferredAreas.includes(item.value)} onPress={() => setPreferredAreas(toggleValue(preferredAreas, item.value))} />)}</View>
    {chips}{notice ? <T style={{ color: colors.primary }}>{notice}</T> : null}{error ? <T accessibilityRole="alert" style={{ color: colors.error }}>{error}</T> : null}
    <Button disabled={updateMutation.isPending || resetMutation.isPending} label={updateMutation.isPending ? 'Đang lưu...' : 'Lưu sở thích'} onPress={() => void save()} />
    <Button disabled={updateMutation.isPending || resetMutation.isPending} label={resetMutation.isPending ? 'Đang đặt lại...' : 'Đặt lại sở thích'} secondary onPress={() => void reset()} />
  </TravelerScaffold>;
}

function TravelPreferencesScreen() {
  const session = useTravelerStore((state) => state.session);
  const apiSession = session?.mode === 'api';
  const query = useTravelPreferences(apiSession);

  if (apiSession && query.isPending) {
    return <TravelerScaffold title="Sở thích du lịch" back><Card><T style={{ color: colors.muted }}>Đang tải sở thích...</T></Card></TravelerScaffold>;
  }
  if (apiSession && query.isError) {
    return <TravelerScaffold title="Sở thích du lịch" back><Card><T style={{ color: colors.error }}>{getProfileErrorMessage(query.error, 'Không thể tải sở thích.')}</T><Button compact label="Thử lại" secondary onPress={() => void query.refetch()} /></Card></TravelerScaffold>;
  }

  const initialPreferences = query.data ?? EMPTY_TRAVEL_PREFERENCES;
  return <TravelPreferencesEditor key={initialPreferences.updatedAt ?? 'empty'} apiSession={apiSession} initialPreferences={initialPreferences} />;
}

function LanguageCurrencyScreen() {
  const profile = useTravelerStore((state) => state.profile);
  const update = useTravelerStore((state) => state.updateProfile);
  const [language, setLanguage] = useState(profile.language);
  const [currency, setCurrency] = useState(profile.currency);
  return <TravelerScaffold title="Ngôn ngữ và tiền tệ" back><Card><T weight="semibold">{profile.name}</T><T style={{ color: colors.muted }}>{profile.email} · Thành viên từ 2026</T></Card><T weight="semibold">Ngôn ngữ ưu tiên</T><View style={{ flexDirection: 'row', gap: 8 }}><Chip label="Tiếng Việt" selected={language === 'Tiếng Việt'} onPress={() => setLanguage('Tiếng Việt')} /><Chip label="English" selected={language === 'English'} onPress={() => setLanguage('English')} /></View><T style={{ color: colors.muted, fontSize: 12 }}>Bản demo hiện hiển thị nội dung bằng tiếng Việt.</T><T weight="semibold">Tiền tệ hiển thị</T><View style={{ flexDirection: 'row', gap: 8 }}><Chip label="VND" selected={currency === 'VND'} onPress={() => setCurrency('VND')} /><Chip label="USD" selected={currency === 'USD'} onPress={() => setCurrency('USD')} /></View><T style={{ color: colors.muted, fontSize: 12 }}>USD là giá quy đổi tham khảo theo tỷ giá demo 1 USD = 25.000 ₫. Giá đặt phòng gốc tính bằng VND.</T><Button label="Lưu thay đổi" onPress={() => { update({ language, currency }); go('profile'); }} /></TravelerScaffold>;
}

function SettingsScreen({ loyalty = false }: { loyalty?: boolean }) {
  const profile = useTravelerStore((state) => state.profile);
  const session = useTravelerStore((state) => state.session);
  return <TravelerScaffold title={loyalty ? 'Ưu đãi thành viên' : 'Cài đặt và phiên đăng nhập'} back><Card><T weight="semibold">{profile.name}</T><T style={{ color: colors.muted }}>{profile.email} · Thành viên từ 2026</T></Card>{loyalty ? <Card><T weight="semibold">Thành viên Booking Travel</T><T style={{ color: colors.muted }}>Ưu đãi demo sẽ hiển thị khi áp dụng mã tại bước đặt phòng.</T></Card> : <><Row label="Thông tin cá nhân" onPress={() => go('edit-profile')} /><Row label="Sở thích du lịch" onPress={() => go('travel-preferences')} /><Row label="Ngôn ngữ & tiền tệ" onPress={() => go('language-currency')} /><Card><T weight="semibold">Phiên đăng nhập hiện tại</T><T style={{ color: colors.muted }}>{session?.mode === 'api' ? `API thật · Vai trò ${session.role}` : 'Chế độ mock · Lưu trên thiết bị'}</T></Card></>}<Button label="Lưu thay đổi" onPress={() => go('profile')} /></TravelerScaffold>;
}

export function AccountScreen({ id }: { id: AccountScreenId }) {
  if (id === 'profile' || id === 'logout-confirm') return <ProfileScreen />;
  if (id === 'edit-profile') return <EditProfileScreen />;
  if (id === 'travel-preferences') return <TravelPreferencesScreen />;
  if (id === 'language-currency') return <LanguageCurrencyScreen />;
  return <SettingsScreen loyalty={id === 'loyalty'} />;
}

export { ProfileScreen };
