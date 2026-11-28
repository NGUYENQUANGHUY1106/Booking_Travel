import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTravelerStore } from "@/features/traveler/store";
import { apiClient } from "@/services/api-client";

const sentiment = {
  POSITIVE: { label: "Tích cực", color: "#18754b" },
  NEUTRAL: { label: "Trung lập", color: "#526279" },
  NEGATIVE: { label: "Tiêu cực", color: "#b93829" },
};

type SummaryResponse = {
  stats: { count: number; average: number | null; sampleCount: number };
} & (
  | {
      status: "INSUFFICIENT" | "UNAVAILABLE";
    }
  | {
      status: "READY";
      generatedAt: string;
      summary: {
        sentiment: {
          label: keyof typeof sentiment;
          count: number;
          percent: number;
        }[];
        topics: {
          topic: string;
          label: string;
          positive: number;
          negative: number;
          count: number;
        }[];
      };
    }
);

export function ReviewSummaryCard({ hotelId }: { hotelId: string }) {
  const session = useTravelerStore((state) => state.session);
  const query = useQuery({
    queryKey: [
      "ai-review-summary",
      hotelId,
      session?.mode === "api" ? session.sessionId : "public",
    ],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<SummaryResponse>(
          "/ai/hotels/" + encodeURIComponent(hotelId) + "/review-summary",
          { signal },
        )
      ).data,
    enabled: false,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });
  const result = query.isError || query.isFetching ? undefined : query.data;

  const topics = result?.status === "READY" ? result.summary.topics : [];
  const highlights = topics
    .filter((item) => item.positive > 0)
    .sort((a, b) => b.positive - a.positive)
    .slice(0, 3)
    .map((item) => item.label);
  const improvements = topics
    .filter((item) => item.negative > 0)
    .sort((a, b) => b.negative - a.negative)
    .slice(0, 3)
    .map((item) => item.label);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>AI tóm tắt đánh giá</Text>
      {result ? (
        <Text style={styles.muted}>
          {result.stats.count} đánh giá công khai
          {result.stats.average !== null
            ? " · " + result.stats.average.toLocaleString("vi-VN") + "/10"
            : ""}
        </Text>
      ) : null}
      {result?.status === "READY" ? (
        <>
          <Text style={styles.muted}>
            Phân tích {result.stats.sampleCount} nhận xét gần nhất ·{" "}
            {new Date(result.generatedAt).toLocaleDateString("vi-VN")}
          </Text>
          {result.summary.sentiment.map((item) => (
            <View key={item.label} style={styles.metric}>
              <Text
                style={[styles.label, { color: sentiment[item.label].color }]}
              >
                {sentiment[item.label].label}
              </Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${item.percent}%`,
                      backgroundColor: sentiment[item.label].color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.muted}>
                {item.count} · {item.percent.toLocaleString("vi-VN")}%
              </Text>
            </View>
          ))}
          {highlights.length ? (
            <Text style={styles.muted}>
              <Text style={styles.label}>Được khen nhiều · </Text>
              {highlights.join(", ")}
            </Text>
          ) : null}
          {improvements.length ? (
            <Text style={styles.muted}>
              <Text style={styles.label}>Cần cải thiện · </Text>
              {improvements.join(", ")}
            </Text>
          ) : null}
          {topics.length ? (
            <Text style={styles.label}>Chủ đề được nhắc đến</Text>
          ) : null}
          {topics.map((item) => (
            <Text key={item.topic} style={styles.muted}>
              {item.label} · {item.count} lượt nhắc · {item.positive} khen ·{" "}
              {item.negative} chê
            </Text>
          ))}
        </>
      ) : null}
      {result?.status === "INSUFFICIENT" ? (
        <Text style={styles.muted}>
          Cần ít nhất 3 đánh giá công khai có nhận xét để phân tích.
        </Text>
      ) : null}
      {query.isError || result?.status === "UNAVAILABLE" ? (
        <Text accessibilityRole="alert" style={styles.muted}>
          Tạm thời chưa tải được tóm tắt. Bạn vẫn có thể đọc các đánh giá.
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={query.isFetching}
        onPress={() => void query.refetch()}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {query.isFetching
            ? "Đang phân tích…"
            : result?.status === "READY"
              ? "Cập nhật tóm tắt"
              : query.isError || result?.status === "UNAVAILABLE"
                ? "Thử lại"
                : "Xem tóm tắt"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderColor: "#dbe5f4",
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#17243b" },
  label: { fontSize: 14, fontWeight: "600", color: "#17243b" },
  muted: { fontSize: 14, lineHeight: 20, color: "#526279" },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  track: {
    flex: 1,
    minWidth: 48,
    backgroundColor: "#e9eff7",
    borderRadius: 8,
    height: 7,
    overflow: "hidden",
  },
  bar: { height: "100%", borderRadius: 8 },
  button: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#eaf1ff",
  },
  buttonText: { fontWeight: "700", color: "#1c50bc" },
});
