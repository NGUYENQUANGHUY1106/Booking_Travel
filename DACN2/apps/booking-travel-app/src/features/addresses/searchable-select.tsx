import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface Option {
  id: string;
  name: string;
  officialCode?: string | null;
}

interface Props<T extends Option> {
  label: string;
  placeholder: string;
  options: T[];
  value?: T;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onChange: (option: T) => void;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

export function SearchableSelect<T extends Option>({
  label,
  placeholder,
  options,
  value,
  disabled,
  loading,
  error,
  onRetry,
  onChange,
}: Props<T>) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return options.slice(0, 100);
    return options
      .filter((item) =>
        normalize(`${item.name} ${item.officialCode ?? ""}`).includes(term),
      )
      .slice(0, 100);
  }, [options, query]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setExpanded((current) => !current)}
        style={[styles.control, disabled && styles.disabled]}
      >
        <Text style={value ? styles.value : styles.placeholder}>
          {value?.name ?? placeholder}
        </Text>
        {loading ? <ActivityIndicator size="small" /> : <Text>⌄</Text>}
      </Pressable>
      {expanded && !disabled ? (
        <View style={styles.menu}>
          <TextInput
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Tìm theo tên hoặc mã…"
            style={styles.search}
            value={query}
          />
          {error ? (
            <Pressable onPress={onRetry} style={styles.option}>
              <Text style={styles.error}>
                Không tải được dữ liệu. Chạm để thử lại.
              </Text>
            </Pressable>
          ) : filtered.length === 0 && !loading ? (
            <Text style={styles.empty}>Không có kết quả.</Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {filtered.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    onChange(item);
                    setExpanded(false);
                    setQuery("");
                  }}
                  style={styles.option}
                >
                  <Text>{item.name}</Text>
                  {item.officialCode ? (
                    <Text style={styles.code}>{item.officialCode}</Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: "#344054", fontSize: 14, fontWeight: "600" },
  control: {
    minHeight: 48,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  disabled: { backgroundColor: "#F2F4F7", opacity: 0.65 },
  value: { color: "#101828", flex: 1 },
  placeholder: { color: "#98A2B3", flex: 1 },
  menu: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    maxHeight: 280,
    overflow: "hidden",
  },
  search: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECF0",
  },
  option: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EAECF0",
  },
  code: { color: "#667085", fontSize: 12 },
  empty: { color: "#667085", padding: 14 },
  error: { color: "#B42318" },
});
