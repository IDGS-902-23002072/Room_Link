import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export const palette = { background: "#F4F7F5", surface: "#FFFFFF", ink: "#17352B", muted: "#667A73", primary: "#13795B", danger: "#B83C35", border: "#DDE7E2" };

export function ModuleLayout({ title, description, tabs, active, onTab, children }) {
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><Text style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text><View style={styles.subtabs}>{tabs.map(([key, label]) => <TouchableOpacity key={key} onPress={() => onTab(key)} style={styles.subtab}><Text style={[styles.subtabText, active === key && styles.subtabActive]}>{label}</Text></TouchableOpacity>)}</View>{children}</ScrollView>;
}

export function Card({ title, children }) { return <View style={styles.card}>{title ? <Text style={styles.cardTitle}>{title}</Text> : null}{children}</View>; }
export function Field({ label, ...props }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput placeholderTextColor="#8A9A94" style={styles.input} {...props} /></View>; }
export function Action({ label, onPress, disabled, danger = false }) { return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.action, danger && styles.actionDanger, disabled && styles.disabled]}><Text style={styles.actionText}>{label}</Text></TouchableOpacity>; }
export function Notice({ error, message }) { return error || message ? <Text style={[styles.notice, error && styles.noticeError]}>{error || message}</Text> : null; }

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 4, paddingBottom: 48, gap: 12 }, title: { color: palette.ink, fontSize: 24, fontWeight: "800" }, description: { color: palette.muted, lineHeight: 20 },
  subtabs: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginVertical: 4 }, subtab: { paddingVertical: 6 }, subtabText: { color: palette.muted, fontWeight: "700" }, subtabActive: { color: palette.primary, textDecorationLine: "underline" },
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 }, cardTitle: { color: palette.ink, fontWeight: "800", fontSize: 17 }, field: { gap: 6 }, label: { color: palette.ink, fontWeight: "700" },
  input: { borderColor: palette.border, borderWidth: 1, borderRadius: 12, color: palette.ink, backgroundColor: "#FBFDFC", padding: 12 }, action: { backgroundColor: palette.primary, padding: 13, borderRadius: 12 }, actionDanger: { backgroundColor: palette.danger }, actionText: { color: "white", textAlign: "center", fontWeight: "800" }, disabled: { opacity: 0.5 }, notice: { color: palette.primary, fontWeight: "700" }, noticeError: { color: palette.danger }
});
