import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { OwnerButton, OwnerScaffold } from '@/features/hotel-owner/components';
import { ownerColors } from '@/features/hotel-owner/styles/tokens';
import { useTravelerStore } from '@/features/traveler/store';

import { ownerApplicationApi, ownerApplicationKey, useOwnerCurrent, type OwnerCurrent, type OwnerDraftInput } from './api';

const FORM_STEPS = ['Thông tin cá nhân', 'Khách sạn đăng ký', 'Kiểm tra hồ sơ'] as const;
const ACCOMMODATION_TYPES = [
  { value: 'HOTEL', label: 'Khách sạn' }, { value: 'RESORT', label: 'Resort' },
  { value: 'VILLA', label: 'Villa' }, { value: 'APARTMENT', label: 'Căn hộ' },
  { value: 'HOMESTAY', label: 'Homestay' }, { value: 'HOSTEL', label: 'Hostel' },
] as const;

function errorMessage(error: unknown, fallback = 'Không thể thực hiện. Vui lòng thử lại.') {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    if (!error.response) return 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.';
    if (error.response.status >= 500 && error.response.status !== 503) return 'Máy chủ không xử lý được hồ sơ. Vui lòng xem lỗi trong terminal backend rồi thử lại.';
    const message = error.response.data?.message;
    if (Array.isArray(message)) return message.join('\n');
    if (message) return message;
    if (error.response.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  return error instanceof Error ? error.message : fallback;
}

function TextCard({ title, body, warning = false }: { title: string; body: string; warning?: boolean }) {
  return <View style={[styles.card, warning && styles.warning]}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.body}>{body}</Text></View>;
}

function SignInNotice() {
  return <OwnerScaffold title="Trở thành chủ khách sạn">
    <TextCard title="Đăng nhập để tiếp tục" body="Bạn cần tài khoản đã xác minh để nộp hồ sơ chủ khách sạn." warning />
    <OwnerButton label="Đăng nhập" onPress={() => router.push({ pathname: '/auth/[id]', params: { id: 'login', returnTo: '/owner-application' } } as Href)} />
    <OwnerButton label="Tạo tài khoản Chủ khách sạn" secondary onPress={() => router.push({ pathname: '/auth/[id]', params: { id: 'register', returnTo: '/owner-application' } } as Href)} />
  </OwnerScaffold>;
}

export function BecomeOwnerScreen() {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'USER' ? session.userId : undefined;
  const current = useOwnerCurrent(userId);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  if (!session || session.mode !== 'api') return <SignInNotice />;
  if (session.role === 'HOTEL_OWNER') return <OwnerScaffold title="Trở thành chủ khách sạn"><TextCard title="Theo dõi hồ sơ Chủ khách sạn" body="Kiểm tra trạng thái và quyền hiện tại trước khi chuyển vai trò." /><OwnerButton label="Xem trạng thái xác minh" onPress={() => router.replace('/owner-application/status' as Href)} /></OwnerScaffold>;
  if (session.role !== 'USER') return <OwnerScaffold title="Trở thành chủ khách sạn"><TextCard title="Không thể đăng ký" body="Tài khoản này không có quyền nộp hồ sơ Chủ khách sạn." /></OwnerScaffold>;

  const application = current.data?.application;
  const start = async () => {
    if (busy) return;
    setActionError('');
    if (application?.status === 'PENDING' || application?.status === 'VERIFIED' || application?.status === 'SUSPENDED') {
      router.push('/owner-application/status' as Href);
      return;
    }
    setBusy(true);
    try {
      if (!application) {
        const draft = await ownerApplicationApi.createDraft();
        queryClient.setQueryData<OwnerCurrent>(ownerApplicationKey(userId!), (old) => old ? { ...old, application: draft } : old);
        await current.refetch();
      }
      router.push('/owner-application/form' as Href);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const buttonLabel = application?.status === 'PENDING' || application?.status === 'VERIFIED' || application?.status === 'SUSPENDED' ? 'Xem trạng thái hồ sơ' : application?.status === 'REJECTED' ? 'Sửa và nộp lại hồ sơ' : application?.status === 'DRAFT' ? 'Tiếp tục hồ sơ' : 'Bắt đầu đăng ký';
  return <OwnerScaffold title="Trở thành chủ khách sạn" footer={<OwnerButton label={busy ? 'Đang xử lý...' : buttonLabel} disabled={busy || current.isPending || current.isError} onPress={() => void start()} />}>
    <View testID="OWN-UI-01" style={styles.group}>
      <TextCard title="Trở thành chủ khách sạn" body="Quản lý khách sạn của bạn sau khi xác minh hồ sơ." />
      <TextCard title="Quyền lợi của bạn" body="Quản lý chỗ ở, phòng, giá, booking, khả dụng và theo dõi doanh thu trong một nơi." />
      {current.isPending ? <ActivityIndicator color={ownerColors.primary} /> : null}
      {current.isError ? <><Text style={styles.error}>{errorMessage(current.error)}</Text><OwnerButton label="Thử lại" secondary onPress={() => void current.refetch()} /></> : null}
      {current.data ? <>
        <Text style={styles.label}>Tên pháp lý</Text>
        <TextCard title={current.data.applicant.fullName} body="Thông tin từ tài khoản đã đăng nhập" />
        <Text style={styles.label}>Thông tin liên hệ</Text>
        <TextCard title={current.data.applicant.phone || current.data.applicant.email || 'Chưa có'} body={current.data.applicant.emailVerified || current.data.applicant.phoneVerified ? 'Đã xác minh' : 'Cần xác minh trước khi gửi hồ sơ'} />
        <TextCard warning title="Trạng thái xác minh" body={application?.status === 'PENDING' ? 'Đang chờ quản trị viên xét duyệt hồ sơ.' : application?.status === 'REJECTED' ? application.rejectionReason || 'Hồ sơ cần bổ sung thông tin.' : 'Thông tin chỉ dùng để xác minh chủ sở hữu.'} />
      </> : null}
      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
    </View>
  </OwnerScaffold>;
}

function FormField({ label, value, onChangeText, error, multiline = false, keyboardType = 'default' }: { label: string; value: string; onChangeText: (value: string) => void; error?: string; multiline?: boolean; keyboardType?: 'default' | 'phone-pad' }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType} multiline={multiline} placeholder={label} placeholderTextColor={ownerColors.muted} style={[styles.input, multiline && styles.multiline, error && styles.inputError]} />{error ? <Text style={styles.error}>{error}</Text> : null}</View>;
}

export function OwnerVerificationFormScreen() {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'USER' ? session.userId : undefined;
  const current = useOwnerCurrent(userId);
  const queryClient = useQueryClient();
  const hydratedKey = useRef<string | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [accommodationType, setAccommodationType] = useState<OwnerDraftInput['accommodationType']>(undefined);
  const [hotelDescription, setHotelDescription] = useState('');
  const [hotelCoverImageUrl, setHotelCoverImageUrl] = useState('');
  const [coverBusy, setCoverBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ businessName?: string; businessAddress?: string; businessPhone?: string }>({});
  const application = current.data?.application;

  useEffect(() => {
    if (!application) return;
    const key = `${application.id}:${application.version}:${application.status}`;
    if (hydratedKey.current === key) return;
    hydratedKey.current = key;
    setBusinessName(application.businessName || '');
    setBusinessAddress(application.businessAddress || '');
    setRepresentativeName(application.representativeName || '');
    setBusinessRegistrationNumber(application.businessRegistrationNumber || '');
    setBusinessPhone(application.businessPhone || '');
    setAccommodationType(application.accommodationType ?? undefined);
    setHotelDescription(application.hotelDescription || '');
    setHotelCoverImageUrl(application.hotelCoverImageUrl || '');
  }, [application]);

  if (!userId) return <SignInNotice />;
  if (current.isPending) return <OwnerScaffold title="Xác minh chủ khách sạn"><ActivityIndicator color={ownerColors.primary} /></OwnerScaffold>;
  if (current.isError) return <OwnerScaffold title="Xác minh chủ khách sạn"><Text style={styles.error}>{errorMessage(current.error)}</Text><OwnerButton label="Thử lại" onPress={() => void current.refetch()} /></OwnerScaffold>;
  if (!application) return <OwnerScaffold title="Xác minh chủ khách sạn"><TextCard title="Chưa có hồ sơ" body="Hãy bắt đầu đăng ký để tạo bản nháp." /><OwnerButton label="Bắt đầu" onPress={() => router.replace('/owner-application' as Href)} /></OwnerScaffold>;
  if (!['DRAFT', 'REJECTED'].includes(application.status)) return <OwnerScaffold title="Xác minh chủ khách sạn"><TextCard title="Hồ sơ đã được gửi" body="Hãy xem trạng thái xác minh hiện tại." /><OwnerButton label="Xem trạng thái" onPress={() => router.replace('/owner-application/status' as Href)} /></OwnerScaffold>;

  const setCached = (updated: typeof application) => queryClient.setQueryData<OwnerCurrent>(ownerApplicationKey(userId), (old) => old ? { ...old, application: updated } : old);
  const reportIssue = (issue: unknown) => {
    setError(errorMessage(issue));
    if (isAxiosError(issue) && issue.response?.status === 409) setConflict(true);
  };
  const save = async (extra: OwnerDraftInput = {}) => {
    const updated = await ownerApplicationApi.updateDraft(application.id, {
      businessName, businessAddress, representativeName, businessRegistrationNumber, businessPhone,
      accommodationType, hotelDescription,
      ...extra,
      expectedRevision: queryClient.getQueryData<OwnerCurrent>(ownerApplicationKey(userId))?.application?.revision ?? application.revision,
    });
    setCached(updated);
    return updated;
  };
  const saveDraft = async () => {
    if (busy || coverBusy) return;
    setBusy(true); setError('');
    try { await save(); setError('Đã lưu bản nháp.'); } catch (issue) { reportIssue(issue); } finally { setBusy(false); }
  };
  const pickCover = async () => {
    if (coverBusy || busy) return;
    setError('');
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets[0]) return;
      setCoverBusy(true);
      const url = await ownerApplicationApi.uploadCover(application.id, picked.assets[0]);
      const saved = await save({ hotelCoverImageUrl: url });
      setHotelCoverImageUrl(saved.hotelCoverImageUrl || url);
    } catch (issue) { reportIssue(issue); } finally { setCoverBusy(false); }
  };
  const removeCover = async () => {
    if (coverBusy || busy) return;
    setCoverBusy(true); setError('');
    try { await save({ hotelCoverImageUrl: '' }); setHotelCoverImageUrl(''); }
    catch (issue) { reportIssue(issue); } finally { setCoverBusy(false); }
  };
  const next = async () => {
    if (busy || coverBusy) return;
    setError('');
    if (step === 1) {
      const errors = {
        businessName: businessName.trim() ? undefined : 'Vui lòng nhập tên cơ sở kinh doanh.',
        businessAddress: businessAddress.trim() ? undefined : 'Vui lòng nhập địa chỉ cơ sở kinh doanh.',
        businessPhone: !/^\+?[0-9][0-9\s-]{7,20}$/.test(businessPhone.trim()) ? 'Vui lòng nhập số điện thoại khách sạn hợp lệ.' : undefined,
      };
      setFieldErrors(errors);
      if (errors.businessName || errors.businessAddress || errors.businessPhone) return;
      if (!accommodationType) return setError('Vui lòng chọn loại chỗ ở.');
      if (!hotelDescription.trim()) return setError('Vui lòng nhập mô tả khách sạn.');
      if (!hotelCoverImageUrl) return setError('Vui lòng tải ảnh bìa khách sạn.');
    }
    setBusy(true);
    try { await save(); setStep((value) => Math.min(2, value + 1)); } catch (issue) { reportIssue(issue); } finally { setBusy(false); }
  };
  const submit = async () => {
    if (busy || coverBusy || !confirmed) return;
    setBusy(true); setError('');
    try {
      const saved = await save();
      const submitted = await ownerApplicationApi.submit(application.id, saved.version, saved.revision);
      setCached(submitted);
      await queryClient.invalidateQueries({ queryKey: ['owner-application-notifications', userId] });
      router.replace('/owner-application/status' as Href);
    } catch (issue) { reportIssue(issue); } finally { setBusy(false); }
  };

  return <OwnerScaffold title="Xác minh chủ khách sạn" footerPadding={146} footer={<View style={styles.footerButtons}>
    <OwnerButton label={step === 2 ? 'Gửi hồ sơ xét duyệt' : 'Tiếp tục'} disabled={busy || coverBusy || (step === 2 && !confirmed)} onPress={() => void (step === 2 ? submit() : next())} />
    <OwnerButton label="Lưu bản nháp" secondary disabled={busy || coverBusy} onPress={() => void saveDraft()} />
  </View>}>
    <View testID="OWN-UI-02" style={styles.group}>
      <Text style={styles.step}>Bước {step + 1}/3 · {FORM_STEPS[step]}</Text>
      {application.status === 'REJECTED' ? <TextCard warning title="Cần bổ sung hồ sơ" body={application.rejectionReason || 'Vui lòng kiểm tra lại thông tin và nộp lại.'} /> : null}
      {step === 0 ? <>
        <TextCard title="Thông tin cá nhân" body="Thông tin được lấy từ tài khoản đã xác minh. Để đổi email hoặc số điện thoại, hãy dùng quy trình xác minh tài khoản." />
        <Text style={styles.label}>Tên pháp lý</Text><TextCard title={current.data!.applicant.fullName} body="Họ và tên tài khoản" />
        <Text style={styles.label}>Thông tin liên hệ</Text><TextCard title={current.data!.applicant.email || current.data!.applicant.phone || 'Chưa có'} body={current.data!.applicant.emailVerified || current.data!.applicant.phoneVerified ? 'Đã xác minh' : 'Chưa xác minh'} />
      </> : null}
      {step === 1 ? <>
        <TextCard title="Thông tin khách sạn" body="Admin duyệt thông tin khách sạn và quyền Chủ khách sạn. Sau khi được duyệt, bạn tiếp tục thêm hạng phòng, tiện nghi và gửi duyệt đăng tin." />
        <FormField label="Tên khách sạn" value={businessName} onChangeText={(value) => { setBusinessName(value); setFieldErrors((old) => ({ ...old, businessName: undefined })); }} error={fieldErrors.businessName} />
        <FormField label="Địa chỉ khách sạn" value={businessAddress} onChangeText={(value) => { setBusinessAddress(value); setFieldErrors((old) => ({ ...old, businessAddress: undefined })); }} error={fieldErrors.businessAddress} multiline />
        <Text style={styles.label}>Loại chỗ ở</Text>
        <View style={styles.typeOptions}>{ACCOMMODATION_TYPES.map((item) => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ selected: accommodationType === item.value }} onPress={() => setAccommodationType(item.value)} style={[styles.typeOption, accommodationType === item.value && styles.typeOptionSelected]}><Text style={styles.body}>{item.label}</Text></Pressable>)}</View>
        <FormField label="Mô tả khách sạn" value={hotelDescription} onChangeText={setHotelDescription} multiline />
        <View style={styles.card}><Text style={styles.label}>Ảnh bìa khách sạn</Text>{hotelCoverImageUrl ? <Image accessibilityLabel="Ảnh bìa khách sạn" source={{ uri: hotelCoverImageUrl }} style={styles.preview} resizeMode="cover" /> : <Text style={styles.body}>Chưa có ảnh bìa.</Text>}<OwnerButton label={coverBusy ? 'Đang tải ảnh...' : hotelCoverImageUrl ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa'} secondary disabled={coverBusy} onPress={() => void pickCover()} />{hotelCoverImageUrl ? <OwnerButton label="Xóa ảnh bìa" secondary disabled={coverBusy} onPress={() => void removeCover()} /> : null}</View>
        <FormField label="Tên người đại diện (nếu có)" value={representativeName} onChangeText={setRepresentativeName} />
        <FormField label="Số đăng ký kinh doanh (nếu có)" value={businessRegistrationNumber} onChangeText={setBusinessRegistrationNumber} />
        <FormField label="Số điện thoại khách sạn" value={businessPhone} onChangeText={(value) => { setBusinessPhone(value); setFieldErrors((old) => ({ ...old, businessPhone: undefined })); }} error={fieldErrors.businessPhone} keyboardType="phone-pad" />
      </> : null}
      {step === 2 ? <>
        <TextCard title="Kiểm tra hồ sơ" body="Hồ sơ sẽ được gửi cho quản trị viên xét duyệt. Quyền Chủ khách sạn chỉ được cấp sau khi hồ sơ được phê duyệt." />
        <TextCard title="Người đăng ký" body={`${current.data!.applicant.fullName}\n${current.data!.applicant.email || current.data!.applicant.phone || ''}`} />
        <TextCard title="Khách sạn đăng ký" body={`${businessName.trim()}\n${businessAddress.trim()}\n${businessPhone.trim()}\n${hotelDescription.trim()}\nẢnh bìa: ${hotelCoverImageUrl ? 'Đã tải lên' : 'Chưa có'}`} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => setConfirmed((value) => !value)} style={styles.confirm}><Text style={styles.cardTitle}>{confirmed ? '☑' : '□'}</Text><Text style={[styles.body, { flex: 1 }]}>Tôi xác nhận thông tin trong hồ sơ là chính xác.</Text></Pressable>
      </> : null}
      {error ? <Text style={error === 'Đã lưu bản nháp.' ? styles.success : styles.error}>{error}</Text> : null}
      {conflict ? <><Text style={styles.body}>Tải lại sẽ thay thế thay đổi chưa lưu trên màn hình này.</Text><OwnerButton label="Tải lại hồ sơ mới nhất" secondary onPress={() => { hydratedKey.current = undefined; setConflict(false); setError(''); void current.refetch(); }} /></> : null}
      {step > 0 ? <OwnerButton label="Quay lại chỉnh sửa" secondary onPress={() => setStep((value) => value - 1)} /> : <OwnerButton label="Về giới thiệu" secondary onPress={() => router.back()} />}
    </View>
  </OwnerScaffold>;
}

export { OwnerVerificationStatusScreen, OwnerRoleSwitcherScreen } from './status-screens';

const styles = StyleSheet.create({
  group: { gap: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, gap: 10 },
  warning: { backgroundColor: ownerColors.yellowSoft },
  cardTitle: { color: ownerColors.text, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  body: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  label: { color: '#374151', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  field: { gap: 8 },
  input: { color: ownerColors.text, backgroundColor: '#FFFFFF', borderRadius: 12, minHeight: 52, padding: 14, fontSize: 16, fontWeight: '600' },
  inputError: { borderWidth: 1, borderColor: '#DC2626' },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  error: { color: '#B91C1C', fontSize: 14, lineHeight: 20 },
  success: { color: '#166534', fontSize: 14, lineHeight: 20 },
  step: { color: ownerColors.primary, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: '#FFFFFF', borderRadius: 12 },
  footerButtons: { gap: 8 },
  preview: { width: '100%', height: 160, borderRadius: 8, backgroundColor: '#F3F4F6' },
  typeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' },
  typeOptionSelected: { borderColor: ownerColors.primary, backgroundColor: '#DBEAFE' },
});
