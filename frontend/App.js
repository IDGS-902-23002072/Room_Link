import { useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthModule } from "./src/modules/auth/AuthModule";
import { MessagingModule } from "./src/modules/messaging/MessagingModule";
import { ModerationModule } from "./src/modules/moderation/ModerationModule";
import { palette } from "./src/shared/ui";

const modules = [["auth", "Acceso"], ["messaging", "Chat"], ["moderation", "Moderación"]];

export default function App() {
  const [module, setModule] = useState("auth");
  const [session, setSession] = useState({ token: null, user: null });
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View><Text style={styles.brand}>Room Link</Text><Text style={styles.subtitle}>Encuentra espacio. Conecta con confianza.</Text></View>
        {session.user ? <Text style={styles.user}>{session.user.email}</Text> : null}
      </View>
      <View style={styles.tabs}>
        {modules.map(([key, label]) => (
          <TouchableOpacity accessibilityRole="button" key={key} onPress={() => setModule(key)} style={[styles.tab, module === key && styles.tabActive]}>
            <Text style={[styles.tabText, module === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {module === "auth" ? <AuthModule session={session} onSession={setSession} /> : null}
      {module === "messaging" ? <MessagingModule token={session.token} /> : null}
      {module === "moderation" ? <ModerationModule token={session.token} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: palette.ink, fontSize: 28, fontWeight: "800" },
  subtitle: { color: palette.muted, fontSize: 12, marginTop: 2 },
  user: { color: palette.primary, fontSize: 12, maxWidth: 150 },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  tab: { flex: 1, padding: 11, borderRadius: 12, backgroundColor: palette.surface },
  tabActive: { backgroundColor: palette.primary },
  tabText: { color: palette.muted, textAlign: "center", fontWeight: "700" },
  tabTextActive: { color: "white" }
});
