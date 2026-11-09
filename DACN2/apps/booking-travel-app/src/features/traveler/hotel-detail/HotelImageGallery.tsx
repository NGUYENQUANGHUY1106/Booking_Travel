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
  type ImageResizeMode,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { publicMediaUrl } from "../public-hotels";
import { colors } from "../theme";
import { T } from "../ui";

type GalleryImage = {
  id: string;
  url: string;
  sortOrder: number;
  isCover: boolean;
};

function GalleryPhoto({
  url,
  style,
  resizeMode = "cover",
}: {
  url: string;
  style: object;
  resizeMode?: ImageResizeMode;
}) {
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
          resizeMode={resizeMode}
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

export function HotelImageGallery({
  images,
  emptyMessage = "Khách sạn chưa có ảnh công khai đã được xác minh",
}: {
  images: GalleryImage[];
  emptyMessage?: string;
}) {
  const ordered = [...images].sort(
    (left, right) =>
      Number(right.isCover) - Number(left.isCover) ||
      left.sortOrder - right.sortOrder,
  );
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
          {emptyMessage}
        </T>
      </View>
    );
  }

  return (
    <>
      <View>
        <ScrollView
          accessibilityLabel="Bộ sưu tập ảnh khách sạn"
          horizontal
          onMomentumScrollEnd={(event) =>
            setPreviewIndex(
              Math.max(
                0,
                Math.min(
                  ordered.length - 1,
                  Math.round(event.nativeEvent.contentOffset.x / width),
                ),
              ),
            )
          }
          pagingEnabled
          showsHorizontalScrollIndicator={false}
        >
          {ordered.map((image, imageIndex) => (
            <Pressable
              accessibilityLabel={`Mở ảnh ${imageIndex + 1} trên ${ordered.length}`}
              key={image.id}
              onPress={() => open(imageIndex)}
            >
              <GalleryPhoto
                style={[styles.hero, { width }]}
                url={image.url}
              />
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.counter}>
          <T weight="semibold" style={styles.counterText}>
            {previewIndex + 1}/{ordered.length} · Vuốt để xem ảnh
          </T>
        </View>
      </View>
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
        presentationStyle="fullScreen"
        visible={visible}
      >
        <SafeAreaView style={styles.modal}>
          <View
            style={[
              styles.modalHeader,
              { top: Math.max(insets.top, 8) },
            ]}
          >
            <T weight="semibold" style={styles.modalText}>
              {index + 1}/{ordered.length}
            </T>
            <Pressable
              accessibilityLabel="Đóng bộ sưu tập"
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => setVisible(false)}
              style={styles.close}
            >
              <T weight="bold" style={styles.modalText}>
                ×
              </T>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            horizontal
            onMomentumScrollEnd={(event) =>
              setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
            }
            pagingEnabled
            ref={scrollRef}
            style={styles.modalScroll}
            showsHorizontalScrollIndicator={false}
          >
            {ordered.map((image) => (
              <GalleryPhoto
                key={image.id}
                resizeMode="contain"
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
  hero: { height: 280 },
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
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
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
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.82)",
  },
  modalScroll: { flex: 1 },
  modalContent: { alignItems: "stretch" },
});
