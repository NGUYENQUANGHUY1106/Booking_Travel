import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { addressCatalogApi } from "./address-api";
import { SearchableSelect } from "./searchable-select";
import type {
  AddressFormValue,
  AddressMode,
  AdministrativeUnit,
  Street,
} from "./types";
import { useDebouncedValue } from "./use-debounced-value";

interface Props {
  initialValue?: Partial<AddressFormValue>;
  initialSelection?: {
    province?: AdministrativeUnit;
    district?: AdministrativeUnit;
    commune?: AdministrativeUnit;
    street?: Street;
  };
  onChange?: (value: Partial<AddressFormValue>) => void;
}

export function AddressForm({
  initialValue,
  initialSelection,
  onChange,
}: Props) {
  const [mode, setMode] = useState<AddressMode>(
    initialValue?.mode ?? "CURRENT",
  );
  const [province, setProvince] = useState<AdministrativeUnit | undefined>(
    initialSelection?.province,
  );
  const [district, setDistrict] = useState<AdministrativeUnit | undefined>(
    initialSelection?.district,
  );
  const [commune, setCommune] = useState<AdministrativeUnit | undefined>(
    initialSelection?.commune,
  );
  const [street, setStreet] = useState<Street | undefined>(
    initialSelection?.street,
  );
  const [streetText, setStreetText] = useState(initialValue?.streetText ?? "");
  const [addressLine, setAddressLine] = useState(
    initialValue?.addressLine ?? "",
  );
  const [postalCode, setPostalCode] = useState(initialValue?.postalCode ?? "");
  const debouncedStreet = useDebouncedValue(streetText, 350);

  const provinces = useQuery({
    queryKey: ["address-provinces", mode],
    queryFn: () => addressCatalogApi.provinces(mode),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const districts = useQuery({
    queryKey: ["address-districts", province?.id],
    queryFn: () => addressCatalogApi.legacyDistricts(province!.id),
    enabled: mode === "LEGACY" && Boolean(province),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const communes = useQuery({
    queryKey: ["address-communes", mode, province?.id, district?.id],
    queryFn: () =>
      mode === "CURRENT"
        ? addressCatalogApi.communes(province!.id)
        : addressCatalogApi.legacyCommunes(district!.id),
    enabled: mode === "CURRENT" ? Boolean(province) : Boolean(district),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const streets = useQuery({
    queryKey: ["address-streets", commune?.id, debouncedStreet],
    queryFn: () => addressCatalogApi.streets(commune!.id, debouncedStreet),
    enabled: Boolean(commune) && debouncedStreet.trim().length >= 2,
  });
  const transitions = useQuery({
    queryKey: ["address-transitions", commune?.id],
    queryFn: () => addressCatalogApi.transitions(commune!.id),
    enabled: mode === "LEGACY" && Boolean(commune),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const formValue = useMemo<Partial<AddressFormValue>>(
    () => ({
      mode,
      provinceUnitId: province?.id,
      districtUnitId: district?.id,
      communeUnitId: commune?.id,
      streetId: street?.id,
      streetText: street ? undefined : streetText.trim() || undefined,
      addressLine,
      postalCode: postalCode.trim() || undefined,
    }),
    [
      addressLine,
      commune,
      district,
      mode,
      postalCode,
      province,
      street,
      streetText,
    ],
  );

  function emit(next?: Partial<AddressFormValue>) {
    queueMicrotask(() => onChange?.({ ...formValue, ...next }));
  }

  function changeMode(next: AddressMode) {
    setMode(next);
    setProvince(undefined);
    setDistrict(undefined);
    setCommune(undefined);
    setStreet(undefined);
    setStreetText("");
    emit({
      mode: next,
      provinceUnitId: undefined,
      districtUnitId: undefined,
      communeUnitId: undefined,
    });
  }

  const preview = [
    addressLine,
    street?.name ?? streetText,
    commune?.name,
    district?.name,
    province?.name,
    "Việt Nam",
  ]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(", ");

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Địa chỉ Việt Nam</Text>
      <View style={styles.segmented}>
        {(["CURRENT", "LEGACY"] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => changeMode(item)}
            style={[styles.segment, mode === item && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                mode === item && styles.segmentTextActive,
              ]}
            >
              {item === "CURRENT" ? "Hiện hành (2 cấp)" : "Lịch sử (3 cấp)"}
            </Text>
          </Pressable>
        ))}
      </View>

      <SearchableSelect
        label="Tỉnh / Thành phố"
        placeholder="Chọn tỉnh hoặc thành phố"
        options={provinces.data ?? []}
        value={province}
        loading={provinces.isFetching}
        error={provinces.isError}
        onRetry={() => void provinces.refetch()}
        onChange={(item) => {
          setProvince(item);
          setDistrict(undefined);
          setCommune(undefined);
          setStreet(undefined);
          emit({
            provinceUnitId: item.id,
            districtUnitId: undefined,
            communeUnitId: undefined,
            streetId: undefined,
          });
        }}
      />
      {mode === "LEGACY" ? (
        <SearchableSelect
          label="Quận / Huyện"
          placeholder="Chọn quận hoặc huyện"
          disabled={!province}
          options={districts.data ?? []}
          value={district}
          loading={districts.isFetching}
          error={districts.isError}
          onRetry={() => void districts.refetch()}
          onChange={(item) => {
            setDistrict(item);
            setCommune(undefined);
            setStreet(undefined);
            emit({
              districtUnitId: item.id,
              communeUnitId: undefined,
              streetId: undefined,
            });
          }}
        />
      ) : null}
      <SearchableSelect
        label="Phường / Xã / Đặc khu"
        placeholder="Chọn đơn vị cấp xã"
        disabled={mode === "CURRENT" ? !province : !district}
        options={communes.data ?? []}
        value={commune}
        loading={communes.isFetching}
        error={communes.isError}
        onRetry={() => void communes.refetch()}
        onChange={(item) => {
          setCommune(item);
          setStreet(undefined);
          setStreetText("");
          emit({
            communeUnitId: item.id,
            streetId: undefined,
            streetText: undefined,
          });
        }}
      />

      {mode === "LEGACY" && commune ? (
        <View style={styles.transitionBox}>
          <Text style={styles.transitionTitle}>
            Đơn vị hiện hành có thể tương ứng
          </Text>
          {transitions.isFetching ? (
            <Text style={styles.hint}>Đang tra cứu bảng chuyển đổi…</Text>
          ) : transitions.isError ? (
            <Pressable onPress={() => void transitions.refetch()}>
              <Text style={styles.errorText}>
                Không tải được. Chạm để thử lại.
              </Text>
            </Pressable>
          ) : (transitions.data?.length ?? 0) === 0 ? (
            <Text style={styles.hint}>Chưa có ánh xạ chính thức.</Text>
          ) : (
            transitions.data?.map((item) => (
              <Text key={item.id} style={styles.transitionItem}>
                • {item.toUnit.name} ({item.toUnit.officialCode})
              </Text>
            ))
          )}
          {(transitions.data?.length ?? 0) > 1 ? (
            <Text style={styles.warningText}>
              Có nhiều kết quả; vui lòng tự xác nhận, hệ thống không tự chuyển
              đổi.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>Đường / phố (không bắt buộc)</Text>
        <TextInput
          editable={Boolean(commune)}
          onChangeText={(value) => {
            setStreetText(value);
            setStreet(undefined);
            emit({ streetText: value, streetId: undefined });
          }}
          placeholder="Nhập tên đường; có thể chọn gợi ý"
          style={styles.input}
          value={street?.name ?? streetText}
        />
        {streets.isFetching ? <Text style={styles.hint}>Đang tìm…</Text> : null}
        {!street && (streets.data?.length ?? 0) > 0 ? (
          <View style={styles.suggestions}>
            {streets.data?.slice(0, 8).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setStreet(item);
                  setStreetText(item.name);
                  emit({ streetId: item.id, streetText: undefined });
                }}
                style={styles.suggestion}
              >
                <Text>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Số nhà / địa chỉ chi tiết *</Text>
        <TextInput
          onChangeText={(value) => {
            setAddressLine(value);
            emit({ addressLine: value });
          }}
          placeholder="Ví dụ: 12A, ngõ 34"
          style={styles.input}
          value={addressLine}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Mã bưu chính (không bắt buộc)</Text>
        <TextInput
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(value) => {
            setPostalCode(value.replace(/\D/g, ""));
            emit({ postalCode: value });
          }}
          placeholder="5–6 chữ số"
          style={styles.input}
          value={postalCode}
        />
      </View>
      <View style={styles.preview}>
        <Text style={styles.previewLabel}>Xem trước</Text>
        <Text style={styles.previewText}>
          {preview || "Địa chỉ đầy đủ sẽ hiển thị tại đây."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  heading: { color: "#101828", fontSize: 22, fontWeight: "700" },
  segmented: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    backgroundColor: "#F2F4F7",
  },
  segment: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
  },
  segmentActive: { backgroundColor: "#FFFFFF" },
  segmentText: { color: "#667085", fontSize: 13, fontWeight: "600" },
  segmentTextActive: { color: "#175CD3" },
  field: { gap: 6 },
  label: { color: "#344054", fontSize: 14, fontWeight: "600" },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  hint: { color: "#667085", fontSize: 12 },
  suggestions: {
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 10,
    overflow: "hidden",
  },
  suggestion: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EAECF0",
  },
  preview: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#EFF8FF",
    gap: 5,
  },
  previewLabel: {
    color: "#175CD3",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  previewText: { color: "#1849A9", lineHeight: 21 },
  transitionBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FFFAEB",
    gap: 6,
  },
  transitionTitle: { color: "#93370D", fontWeight: "700" },
  transitionItem: { color: "#7A2E0E" },
  warningText: { color: "#B54708", fontSize: 12, lineHeight: 18 },
  errorText: { color: "#B42318" },
});
