import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { publicMediaUrl } from "../public-hotels";
import { colors } from "../theme";
import { T } from "../ui";

type GalleryImage = {
  id: string;
  url: string;
  sortOrder: number;
  isCover: boolean;
};

function GalleryPhoto({ url, style }: { url: string; style: object }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  return (
    <View style={[style, styles.photoFrame]}>
      {!failed ? (
        <Image
          onError={() => {
            setFailed(true);
            setLoading(false);
          }}
          onLoadEnd={() => setLoading(false)}
          resizeMode="cover"
          source={{ uri: publicMediaUrl(url) }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <T style={styles.placeholderText}>Không tải được ảnh</T>
      )}
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
    </View>
  );
}

export function HotelImageGallery({ images }: { images: GalleryImage[] }) {
  const ordered = [...images].sort(
    (left, right) =>
      Number(right.isCover) - Number(left.isCover) ||
      left.sortOrder - right.sortOrder,
  );
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollViewInstance>(null);

  const open = (nextIndex = 0) => {
    setIndex(nextIndex);
    setVisible(true);
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ x: nextIndex * width, animated: false }),
    );
  };

  if (!ordered.length) {
    return (
      <View style={styles.empty}>
        <T weight="semibold" style={styles.placeholderText}>
          Khách sạn chưa có ảnh công khai đã được xác minh
        </T>
      </View>
    );
  }

  return (
    <>
      <Pressable accessibilityLabel="Mở bộ sưu tập ảnh" onPress={() => open(0)}>
        <GalleryPhoto style={styles.hero} url={ordered[0].url} />
        <View style={styles.counter}>
          <T weight="semibold" style={styles.counterText}>
            1/{ordered.length} · Xem tất cả ảnh
          </T>
        </View>
      </Pressable>
      {ordered.length > 1 ? (
        <ScrollView
          contentContainerStyle={styles.thumbnails}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {ordered.slice(1, 5).map((image, imageIndex) => (
            <Pressable key={image.id} onPress={() => open(imageIndex + 1)}>
              <GalleryPhoto style={styles.thumbnail} url={image.url} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        visible={visible}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <T weight="semibold" style={styles.modalText}>
              {index + 1}/{ordered.length}
            </T>
            <Pressable
              accessibilityLabel="Đóng bộ sưu tập"
              onPress={() => setVisible(false)}
              style={styles.close}
            >
              <T weight="bold" style={styles.modalText}>
                ×
              </T>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            onMomentumScrollEnd={(event) =>
              setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
            }
            pagingEnabled
            ref={scrollRef}
            showsHorizontalScrollIndicator={false}
          >
            {ordered.map((image) => (
              <GalleryPhoto
                key={image.id}
                style={{ width, height: "100%" }}
                url={image.url}
              />
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", height: 280 },
  empty: {
    height: 230,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#E8EFF8",
  },
  photoFrame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#E8EFF8",
  },
  placeholderText: { color: colors.muted, textAlign: "center" },
  counter: {
    position: "absolute",
    right: 16,
    bottom: 14,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(15,23,42,0.78)",
  },
  counterText: { color: colors.white, fontSize: 12 },
  thumbnails: { gap: 8, padding: 12 },
  thumbnail: { width: 106, height: 74, borderRadius: 10 },
  modal: { flex: 1, backgroundColor: "#020617" },
  modalHeader: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalText: { color: colors.white, fontSize: 17 },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
