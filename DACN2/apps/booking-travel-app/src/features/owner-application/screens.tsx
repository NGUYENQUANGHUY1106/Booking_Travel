import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { OwnerButton, OwnerScaffold } from '@/features/hotel-owner/components';
import { ownerColors } from '@/features/hotel-owner/styles/tokens';
import { useTravelerStore } from '@/features/traveler/store';

import { ownerApplicationApi, ownerApplicationKey, useOwnerCurrent, type DocumentPurpose, type OwnerCurrent } from './api';

const FORM_STEPS = ['Thông tin cá nhân', 'Cơ sở kinh doanh', 'Giấy tờ xác minh', 'Kiểm tra hồ sơ'] as const;
type DocumentState = { asset?: DocumentPicker.DocumentPickerAsset; id?: string; pendingMediaId?: string; name?: string; size?: number; progress?: number; error?: string; busy?: boolean };

function errorMessage(error: unknown, fallback = 'Không thể thực hiện. Vui lòng thử lại.') {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    if (!error.response) return 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.';
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
  if (session.role === 'HOTEL_OWNER') return <OwnerScaffold title="Trở thành chủ khách sạn"><TextCard title="Hồ sơ đã được xác minh" body="Bạn đã có quyền Chủ khách sạn." /><OwnerButton label="Vào trang Chủ khách sạn" onPress={() => router.replace('/hotel-owner' as Href)} /></OwnerScaffold>;
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

  const buttonLabel = application?.status === 'PENDING' ? 'Xem trạng thái hồ sơ' : application?.status === 'REJECTED' ? 'Sửa và nộp lại hồ sơ' : application?.status === 'DRAFT' ? 'Tiếp tục hồ sơ' : 'Bắt đầu đăng ký';
  return <OwnerScaffold title="Trở thành chủ khách sạn" footer={<OwnerButton label={busy ? 'Đang xử lý...' : buttonLabel} disabled={busy || current.isPending} onPress={() => void start()} />}>
    <View testID="OWN-UI-01" style={styles.group}>
      <TextCard title="Trở thành chủ khách sạn" body="Quản lý khách sạn của bạn sau khi xác minh hồ sơ." />
      <TextCard title="Quyền lợi của bạn" body="Quản lý chỗ ở, phòng, giá, booking, khả dụng và theo dõi doanh thu trong một nơi." />
      {current.isPending ? <ActivityIndicator color={ownerColors.primary} /> : null}
      {current.isError ? <Text style={styles.error}>{errorMessage(current.error)}</Text> : null}
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

function DocumentField({ title, description, document, onPick, onRetry, onRemove }: { title: string; description: string; document: DocumentState; onPick: () => void; onRetry: () => void; onRemove: () => void }) {
  return <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text><Text style={styles.body}>{description}</Text>
    {document.id ? <Text style={styles.success}>✓ {document.name || 'Đã tải tài liệu lên'}{document.size ? ` · ${(document.size / 1024 / 1024).toFixed(1)} MB` : ''}</Text> : null}
    {document.asset?.mimeType?.startsWith('image/') ? <Image accessibilityLabel={`Xem trước ${title}`} source={{ uri: document.asset.uri }} resizeMode="contain" style={styles.preview} /> : null}
    {document.busy ? <Text style={styles.body}>Đang tải lên {document.progress ?? 0}%...</Text> : null}
    {document.error ? <Text style={styles.error}>{document.error}</Text> : null}
    <OwnerButton label={document.id ? 'Chọn tài liệu khác' : 'Chọn tài liệu'} secondary disabled={document.busy} onPress={onPick} />
    {document.error && document.asset ? <OwnerButton label="Thử tải lại" secondary onPress={onRetry} /> : null}
    {document.id ? <OwnerButton label="Xóa tài liệu" danger onPress={onRemove} /> : null}
  </View>;
}

export function OwnerVerificationFormScreen() {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'USER' ? session.userId : undefined;
  const current = useOwnerCurrent(userId);
  const queryClient = useQueryClient();
  const hydratedId = useRef<string | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [identity, setIdentity] = useState<DocumentState>({});
  const [license, setLicense] = useState<DocumentState>({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ businessName?: string; businessAddress?: string; businessPhone?: string }>({});
  const application = current.data?.application;

  useEffect(() => {
    if (!application || hydratedId.current === application.id) return;
    hydratedId.current = application.id;
    setBusinessName(application.businessName || '');
    setBusinessAddress(application.businessAddress || '');
    setRepresentativeName(application.representativeName || '');
    setBusinessRegistrationNumber(application.businessRegistrationNumber || '');
    setBusinessPhone(application.businessPhone || '');
    setIdentity(application.identityDocument ? { id: application.identityDocument.id, size: application.identityDocument.expectedSize } : {});
    setLicense(application.businessLicenseDocument ? { id: application.businessLicenseDocument.id, size: application.businessLicenseDocument.expectedSize } : {});
  }, [application]);

  if (!userId) return <SignInNotice />;
  if (current.isPending) return <OwnerScaffold title="Xác minh chủ khách sạn"><ActivityIndicator color={ownerColors.primary} /></OwnerScaffold>;
  if (current.isError) return <OwnerScaffold title="Xác minh chủ khách sạn"><Text style={styles.error}>{errorMessage(current.error)}</Text><OwnerButton label="Thử lại" onPress={() => void current.refetch()} /></OwnerScaffold>;
  if (!application) return <OwnerScaffold title="Xác minh chủ khách sạn"><TextCard title="Chưa có hồ sơ" body="Hãy bắt đầu đăng ký để tạo bản nháp." /><OwnerButton label="Bắt đầu" onPress={() => router.replace('/owner-application' as Href)} /></OwnerScaffold>;
  if (!['DRAFT', 'REJECTED'].includes(application.status)) return <OwnerScaffold title="Xác minh chủ khách sạn"><TextCard title="Hồ sơ đã được gửi" body="Hãy xem trạng thái xác minh hiện tại." /><OwnerButton label="Xem trạng thái" onPress={() => router.replace('/owner-application/status' as Href)} /></OwnerScaffold>;

  const setCached = (updated: typeof application) => queryClient.setQueryData<OwnerCurrent>(ownerApplicationKey(userId), (old) => old ? { ...old, application: updated } : old);
  const save = async (extra: { identityDocumentId?: string | null; businessLicenseDocumentId?: string | null } = {}) => {
    const updated = await ownerApplicationApi.updateDraft(application.id, {
      businessName, businessAddress, representativeName, businessRegistrationNumber, businessPhone,
      ...extra,
    });
    setCached(updated);
    return updated;
  };
  const saveDraft = async () => {
    if (busy || identity.busy || license.busy) return;
    setBusy(true); setError('');
    try { await save(); setError('Đã lưu bản nháp.'); } catch (issue) { setError(errorMessage(issue)); } finally { setBusy(false); }
  };
  const upload = async (purpose: DocumentPurpose, asset: DocumentPicker.DocumentPickerAsset) => {
    const setDocument = purpose === 'IDENTITY' ? setIdentity : setLicense;
    setDocument((old) => ({ ...old, asset, pendingMediaId: undefined, name: asset.name, size: asset.size, busy: true, progress: 0, error: undefined }));
    try {
      const media = await ownerApplicationApi.upload(asset, purpose, (progress) => setDocument((old) => ({ ...old, progress })), (pendingMediaId) => setDocument((old) => ({ ...old, pendingMediaId })));
      const updated = await save(purpose === 'IDENTITY' ? { identityDocumentId: media.id } : { businessLicenseDocumentId: media.id });
      setCached(updated);
      setDocument((old) => ({ ...old, id: media.id, pendingMediaId: undefined, busy: false, progress: 100, error: undefined }));
    } catch (issue) {
      setDocument((old) => ({ ...old, busy: false, error: errorMessage(issue, 'Không thể tải tài liệu lên.') }));
    }
  };
  const retry = async (purpose: DocumentPurpose) => {
    const document = purpose === 'IDENTITY' ? identity : license;
    const setDocument = purpose === 'IDENTITY' ? setIdentity : setLicense;
    if (!document.pendingMediaId) {
      if (document.asset) await upload(purpose, document.asset);
      return;
    }
    setDocument((old) => ({ ...old, busy: true, error: undefined }));
    try {
      const media = await ownerApplicationApi.finalize(document.pendingMediaId);
      const updated = await save(purpose === 'IDENTITY' ? { identityDocumentId: media.id } : { businessLicenseDocumentId: media.id });
      setCached(updated);
      setDocument((old) => ({ ...old, id: media.id, pendingMediaId: undefined, busy: false, error: undefined }));
    } catch (issue) {
      setDocument((old) => ({ ...old, busy: false, error: errorMessage(issue) }));
    }
  };
  const pick = async (purpose: DocumentPurpose) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'application/pdf'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets[0]) await upload(purpose, result.assets[0]);
    } catch (issue) {
      (purpose === 'IDENTITY' ? setIdentity : setLicense)((old) => ({ ...old, error: errorMessage(issue) }));
    }
  };
  const remove = async (purpose: DocumentPurpose) => {
    const doc = purpose === 'IDENTITY' ? identity : license;
    setBusy(true); setError('');
    try {
      await save(purpose === 'IDENTITY' ? { identityDocumentId: null } : { businessLicenseDocumentId: null });
      (purpose === 'IDENTITY' ? setIdentity : setLicense)({});
      if (doc.id) void apiClientRemove(doc.id);
    } catch (issue) { setError(errorMessage(issue)); } finally { setBusy(false); }
  };
  const next = async () => {
    if (busy || identity.busy || license.busy) return;
    setError('');
    if (step === 1) {
      const errors = {
        businessName: businessName.trim() ? undefined : 'Vui lòng nhập tên cơ sở kinh doanh.',
        businessAddress: businessAddress.trim() ? undefined : 'Vui lòng nhập địa chỉ cơ sở kinh doanh.',
        businessPhone: businessPhone.trim() && !/^\+?[0-9][0-9\s-]{7,20}$/.test(businessPhone.trim()) ? 'Số điện thoại cơ sở không hợp lệ.' : undefined,
      };
      setFieldErrors(errors);
      if (errors.businessName || errors.businessAddress || errors.businessPhone) return;
    }
    if (step === 2 && (!identity.id || !license.id)) return setError('Vui lòng tải đầy đủ giấy tờ và hoàn tất xác minh tệp.');
    setBusy(true);
    try { await save(); setStep((value) => Math.min(3, value + 1)); } catch (issue) { setError(errorMessage(issue)); } finally { setBusy(false); }
  };
  const submit = async () => {
    if (busy || !confirmed || !identity.id || !license.id) return;
    setBusy(true); setError('');
    try {
      await save();
      const submitted = await ownerApplicationApi.submit(application.id);
      setCached(submitted);
      router.replace('/owner-application/status' as Href);
    } catch (issue) { setError(errorMessage(issue)); } finally { setBusy(false); }
  };

  return <OwnerScaffold title="Xác minh chủ khách sạn" footerPadding={146} footer={<View style={styles.footerButtons}>
    <OwnerButton label={step === 3 ? 'Gửi hồ sơ xét duyệt' : 'Tiếp tục'} disabled={busy || identity.busy || license.busy || (step === 3 && !confirmed)} onPress={() => void (step === 3 ? submit() : next())} />
    <OwnerButton label="Lưu bản nháp" secondary disabled={busy || identity.busy || license.busy} onPress={() => void saveDraft()} />
  </View>}>
    <View testID="OWN-UI-02" style={styles.group}>
      <Text style={styles.step}>Bước {step + 1}/4 · {FORM_STEPS[step]}</Text>
      {application.status === 'REJECTED' ? <TextCard warning title="Cần bổ sung hồ sơ" body={application.rejectionReason || 'Vui lòng kiểm tra lại thông tin và nộp lại.'} /> : null}
      {step === 0 ? <>
        <TextCard title="Thông tin cá nhân" body="Thông tin được lấy từ tài khoản đã xác minh. Để đổi email hoặc số điện thoại, hãy dùng quy trình xác minh tài khoản." />
        <Text style={styles.label}>Tên pháp lý</Text><TextCard title={current.data!.applicant.fullName} body="Họ và tên tài khoản" />
        <Text style={styles.label}>Thông tin liên hệ</Text><TextCard title={current.data!.applicant.email || current.data!.applicant.phone || 'Chưa có'} body={current.data!.applicant.emailVerified || current.data!.applicant.phoneVerified ? 'Đã xác minh' : 'Chưa xác minh'} />
      </> : null}
      {step === 1 ? <>
        <TextCard title="Thông tin cơ sở kinh doanh" body="Dữ liệu này phục vụ xét duyệt hồ sơ, chưa tạo khách sạn trên hệ thống." />
        <FormField label="Tên cơ sở kinh doanh" value={businessName} onChangeText={(value) => { setBusinessName(value); setFieldErrors((old) => ({ ...old, businessName: undefined })); }} error={fieldErrors.businessName} />
        <FormField label="Địa chỉ cơ sở kinh doanh" value={businessAddress} onChangeText={(value) => { setBusinessAddress(value); setFieldErrors((old) => ({ ...old, businessAddress: undefined })); }} error={fieldErrors.businessAddress} multiline />
        <FormField label="Tên người đại diện (nếu có)" value={representativeName} onChangeText={setRepresentativeName} />
        <FormField label="Số đăng ký kinh doanh (nếu có)" value={businessRegistrationNumber} onChangeText={setBusinessRegistrationNumber} />
        <FormField label="Số điện thoại cơ sở (nếu có)" value={businessPhone} onChangeText={(value) => { setBusinessPhone(value); setFieldErrors((old) => ({ ...old, businessPhone: undefined })); }} error={fieldErrors.businessPhone} keyboardType="phone-pad" />
      </> : null}
      {step === 2 ? <>
        <TextCard warning title="Giấy tờ được bảo vệ" body="Tài liệu chỉ dùng để xác minh và được lưu riêng tư. Hỗ trợ JPG, PNG, PDF; tối đa 10 MB mỗi tệp." />
        <DocumentField title="Giấy tờ định danh" description="Chọn giấy tờ phục vụ xác minh danh tính." document={identity} onPick={() => void pick('IDENTITY')} onRetry={() => void retry('IDENTITY')} onRemove={() => void remove('IDENTITY')} />
        <DocumentField title="Giấy phép kinh doanh" description="Chọn giấy phép kinh doanh của cơ sở." document={license} onPick={() => void pick('BUSINESS_LICENSE')} onRetry={() => void retry('BUSINESS_LICENSE')} onRemove={() => void remove('BUSINESS_LICENSE')} />
      </> : null}
      {step === 3 ? <>
        <TextCard title="Kiểm tra hồ sơ" body="Hồ sơ sẽ được gửi cho quản trị viên xét duyệt. Quyền Chủ khách sạn chỉ được cấp sau khi hồ sơ được phê duyệt." />
        <TextCard title="Người đăng ký" body={`${current.data!.applicant.fullName}\n${current.data!.applicant.email || current.data!.applicant.phone || ''}`} />
        <TextCard title="Cơ sở kinh doanh" body={`${businessName.trim()}\n${businessAddress.trim()}`} />
        <TextCard title="Tài liệu" body={`Giấy tờ định danh: ${identity.id ? 'Đã tải lên' : 'Chưa có'}\nGiấy phép kinh doanh: ${license.id ? 'Đã tải lên' : 'Chưa có'}`} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => setConfirmed((value) => !value)} style={styles.confirm}><Text style={styles.cardTitle}>{confirmed ? '☑' : '□'}</Text><Text style={[styles.body, { flex: 1 }]}>Tôi xác nhận thông tin trong hồ sơ là chính xác.</Text></Pressable>
      </> : null}
      {error ? <Text style={error === 'Đã lưu bản nháp.' ? styles.success : styles.error}>{error}</Text> : null}
      {step > 0 ? <OwnerButton label="Quay lại chỉnh sửa" secondary onPress={() => setStep((value) => value - 1)} /> : <OwnerButton label="Về giới thiệu" secondary onPress={() => router.back()} />}
    </View>
  </OwnerScaffold>;
}

async function apiClientRemove(id: string) {
  try { const { apiClient } = await import('@/services/api-client'); await apiClient.delete(`/media/${id}`); } catch { /* An unattached private object can be cleaned up later. */ }
}

export function OwnerVerificationStatusScreen() {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'USER' ? session.userId : undefined;
  const current = useOwnerCurrent(userId);
  if (session?.mode === 'api' && session.role === 'HOTEL_OWNER') {
    return <OwnerScaffold title="Trạng thái xác minh"><View testID="OWN-UI-03" style={styles.group}><TextCard title="Đã xác minh" body="Tài khoản đã có quyền Chủ khách sạn." /><OwnerButton label="Vào trang Chủ khách sạn" onPress={() => router.replace('/hotel-owner' as Href)} /></View></OwnerScaffold>;
  }
  if (!userId) return <SignInNotice />;
  const application = current.data?.application;
  const statusText = application?.status === 'PENDING' ? 'Đang chờ xét duyệt' : application?.status === 'REJECTED' ? 'Cần bổ sung hồ sơ' : application?.status === 'DRAFT' ? 'Hồ sơ nháp' : application?.status === 'SUSPENDED' ? 'Quyền Chủ khách sạn bị tạm ngưng' : application?.status === 'VERIFIED' ? 'Đã xác minh' : 'Chưa có hồ sơ';
  const description = application?.status === 'PENDING' ? 'Hồ sơ của bạn đã được gửi và đang chờ quản trị viên xem xét.' : application?.status === 'REJECTED' ? application.rejectionReason || 'Hồ sơ cần chỉnh sửa trước khi nộp lại.' : application?.status === 'DRAFT' ? 'Bạn có thể tiếp tục hoàn thiện hồ sơ.' : application?.status === 'SUSPENDED' ? 'Vui lòng liên hệ bộ phận hỗ trợ để biết thêm chi tiết.' : application?.status === 'VERIFIED' ? 'Bạn có thể chuyển sang chế độ Chủ khách sạn.' : 'Hãy bắt đầu đăng ký Chủ khách sạn.';
  return <OwnerScaffold title="Trạng thái xác minh">
    <View testID="OWN-UI-03" style={styles.group}>
      {current.isPending ? <ActivityIndicator color={ownerColors.primary} /> : null}
      {current.isError ? <Text style={styles.error}>{errorMessage(current.error)}</Text> : null}
      <TextCard warning title={statusText} body={description} />
      {application?.submittedAt ? <TextCard title="Hồ sơ đã được gửi" body={`Lần gửi: ${new Date(application.submittedAt).toLocaleDateString('vi-VN')} · Phiên bản ${application.version}`} /> : null}
      {application?.status === 'REJECTED' || application?.status === 'DRAFT' ? <OwnerButton label="Chỉnh sửa hồ sơ" onPress={() => router.push('/owner-application/form' as Href)} /> : null}
      {application?.status === 'VERIFIED' ? <TextCard title="Cập nhật phiên đăng nhập" body="Vui lòng đăng nhập lại để cập nhật quyền Chủ khách sạn từ máy chủ." /> : null}
      <OwnerButton label="Tải lại trạng thái" secondary onPress={() => void current.refetch()} />
      <OwnerButton label="Về tài khoản" secondary onPress={() => router.replace('/user/profile' as Href)} />
    </View>
  </OwnerScaffold>;
}

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
});
