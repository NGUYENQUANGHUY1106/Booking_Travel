import { AddressForm } from "@/features/addresses";
import { Stack } from "expo-router";
import { SafeAreaView, ScrollView, StyleSheet } from "react-native";

export default function AddressDemoScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: "Địa chỉ", headerShown: true }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AddressForm />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { padding: 20, paddingBottom: 48 },
});
