import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, font, radius, shadow, space, weight } from "./theme";
import { Icon } from "./icons";

// Re-export para compatibilidad con imports antiguos.
export { palette } from "./theme";

const toneMap = {
  purple: { bg: colors.secondary, fg: colors.white, soft: colors.primarySoft, ink: colors.primary },
  teal: { bg: colors.teal, fg: colors.white, soft: colors.tealSurface, ink: colors.tealDeep },
  lavender: { bg: colors.lavender, fg: colors.ink, soft: colors.lavenderSoft, ink: colors.primary },
  success: { bg: colors.success, fg: colors.white, soft: colors.successSoft, ink: colors.success },
  danger: { bg: colors.danger, fg: colors.white, soft: colors.dangerSoft, ink: colors.danger },
  warning: { bg: colors.warning, fg: colors.white, soft: colors.warningSoft, ink: colors.warning },
  neutral: { bg: colors.line, fg: colors.body, soft: colors.surfaceAlt, ink: colors.muted },
};

/* -------------------------------------------------------------- Layout */

export function Screen({ children, scroll = true, nav = null, style }) {
  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? { contentContainerStyle: [styles.scrollBody, style], keyboardShouldPersistTaps: "handled", showsVerticalScrollIndicator: false }
    : { style: [styles.flexBody, style] };
  return (
    <SafeAreaView style={styles.screen}>
      <Body {...bodyProps}>{children}</Body>
      {nav}
    </SafeAreaView>
  );
}

export function Logo({ size = 22, color = colors.primary }) {
  return (
    <View style={styles.logoRow}>
      <Icon name="home" size={size} color={color} />
      <Text style={[styles.logoText, { fontSize: size, color }]}>RoomLink</Text>
    </View>
  );
}

export function ScreenHeader({ eyebrow, title, subtitle, right, onBack }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backBtn} hitSlop={10}>
          <Icon name="back" size={22} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.headerTexts}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.h1}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

export function FooterNote({ children = "RoomLink · Conecta con confianza" }) {
  return <Text style={styles.footerNote}>{children}</Text>;
}

/* -------------------------------------------------------------- Buttons */

export function Button({ label, onPress, variant = "primary", disabled, loading, icon, style }) {
  const v = styles[`btn_${variant}`] || styles.btn_primary;
  const t = styles[`btnText_${variant}`] || styles.btnText_primary;
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.85}
      disabled={isDisabled}
      onPress={onPress}
      style={[styles.btn, v, isDisabled && styles.btnDisabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.white : colors.primary} />
      ) : (
        <View style={styles.btnInner}>
          {icon ? <Icon name={icon} size={18} color={t.color} /> : null}
          <Text style={[styles.btnText, t]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function GoogleButton({ label = "Continuar con Google", onPress, disabled }) {
  return (
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.85} disabled={disabled} onPress={onPress} style={[styles.btn, styles.btn_secondary, disabled && styles.btnDisabled]}>
      <View style={styles.btnInner}>
        <View style={styles.googleG}>
          <Text style={styles.googleGText}>G</Text>
        </View>
        <Text style={[styles.btnText, styles.btnText_secondary]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function LinkText({ children, onPress, align = "left", tone = "primary" }) {
  return (
    <TouchableOpacity accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <Text style={[styles.link, { textAlign: align, color: tone === "muted" ? colors.muted : colors.primary }]}>{children}</Text>
    </TouchableOpacity>
  );
}

/* -------------------------------------------------------------- Inputs */

export function TextField({ label, value, onChangeText, secureTextEntry, hint, ...props }) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={hidden}
          placeholderTextColor={colors.faint}
          style={styles.input}
          {...props}
        />
        {secureTextEntry ? (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Text style={styles.reveal}>{hidden ? "Mostrar" : "Ocultar"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Checkbox({ checked, onToggle, title, subtitle }) {
  return (
    <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onToggle(!checked)} style={styles.checkRow} activeOpacity={0.8}>
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>{checked ? <Icon name="check" size={14} color={colors.white} /> : null}</View>
      <View style={styles.flex1}>
        <Text style={styles.checkTitle}>{title}</Text>
        {subtitle ? <Text style={styles.checkSub}>{subtitle}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export function SearchField({ value, onChangeText, placeholder = "Buscar" }) {
  return (
    <View style={styles.search}>
      <Icon name="search" size={18} color={colors.muted} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.faint} style={styles.searchInput} />
    </View>
  );
}

/* -------------------------------------------------------------- Surfaces */

export function Card({ children, style, onPress, padded = true }) {
  const inner = <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>;
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

export function HeroCard({ tone = "teal", title, subtitle, icon }) {
  const t = toneMap[tone] || toneMap.teal;
  return (
    <View style={[styles.hero, { backgroundColor: t.bg }]}>
      {icon ? <Icon name={icon} size={26} color={t.fg} /> : null}
      <Text style={[styles.heroTitle, { color: t.fg }]}>{title}</Text>
      {subtitle ? <Text style={[styles.heroSub, { color: t.fg }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Chip({ label, tone = "lavender", active = false }) {
  const t = toneMap[tone] || toneMap.lavender;
  return (
    <View style={[styles.chip, { backgroundColor: active ? t.bg : t.soft }]}>
      <Text style={[styles.chipText, { color: active ? t.fg : t.ink }]}>{label}</Text>
    </View>
  );
}

export function StatusChip({ label, tone = "neutral" }) {
  const t = toneMap[tone] || toneMap.neutral;
  return (
    <View style={[styles.statusChip, { backgroundColor: t.soft }]}>
      <View style={[styles.statusDot, { backgroundColor: t.bg }]} />
      <Text style={[styles.statusText, { color: t.ink }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ label = "?", size = 44, tone = "purple" }) {
  const t = toneMap[tone] || toneMap.purple;
  const initials = String(label)
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.soft }]}>
      <Text style={[styles.avatarText, { color: t.ink, fontSize: size * 0.36 }]}>{initials || "?"}</Text>
    </View>
  );
}

/* -------------------------------------------------------------- Tabs / Nav */

export function SegmentedTabs({ tabs, active, onChange }) {
  return (
    <View style={styles.segment}>
      {tabs.map(({ key, label, badge }) => {
        const on = key === active;
        return (
          <TouchableOpacity key={key} onPress={() => onChange(key)} style={[styles.segmentItem, on && styles.segmentItemOn]} activeOpacity={0.8}>
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{label}</Text>
            {badge != null ? (
              <View style={[styles.segmentBadge, on && styles.segmentBadgeOn]}>
                <Text style={[styles.segmentBadgeText, on && styles.segmentBadgeTextOn]}>{badge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function BottomNav({ items, active, onChange }) {
  return (
    <View style={styles.nav}>
      {items.map(({ key, label, icon }) => {
        const on = key === active;
        return (
          <Pressable key={key} onPress={() => onChange(key)} style={styles.navItem}>
            <View style={[styles.navIconWrap, on && styles.navIconWrapOn]}>
              <Icon name={icon} size={22} color={on ? colors.primary : colors.muted} filled={on} />
            </View>
            <Text style={[styles.navLabel, on && styles.navLabelOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------- Messaging */

export function MessageBubble({ mine, text, meta }) {
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{text}</Text>
      </View>
      {meta ? <Text style={styles.bubbleMeta}>{meta}</Text> : null}
    </View>
  );
}

export function MessageInput({ value, onChangeText, onSend, disabled }) {
  return (
    <View style={styles.composer}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Escribe un mensaje…"
        placeholderTextColor={colors.faint}
        style={styles.composerInput}
        multiline
      />
      <TouchableOpacity onPress={onSend} disabled={disabled} style={[styles.sendBtn, disabled && styles.btnDisabled]} activeOpacity={0.85}>
        <Icon name="send" size={18} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

/* -------------------------------------------------------------- Feedback */

export function Notice({ error, message }) {
  if (!error && !message) return null;
  const danger = Boolean(error);
  return (
    <View style={[styles.notice, danger ? styles.noticeDanger : styles.noticeOk]}>
      <Icon name={danger ? "warning" : "check"} size={16} color={danger ? colors.danger : colors.success} />
      <Text style={[styles.noticeText, { color: danger ? colors.danger : colors.success }]}>{error || message}</Text>
    </View>
  );
}

export function EmptyState({ icon = "compass", title, subtitle }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={30} color={colors.secondary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

export function Row({ children, gap = space.sm, style, align = "center", justify }) {
  return <View style={[{ flexDirection: "row", alignItems: align, gap }, justify && { justifyContent: justify }, style]}>{children}</View>;
}

export function Label({ children, style }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

/* -------------------------------------------------------------- Styles */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollBody: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  flexBody: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.lg },

  logoRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  logoText: { fontFamily: font.family, fontWeight: weight.bold, letterSpacing: -0.4 },

  header: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  headerTexts: { flex: 1, gap: 2 },
  headerRight: { marginLeft: "auto" },
  backBtn: { marginTop: 4 },
  eyebrow: { fontFamily: font.family, color: colors.muted, fontSize: font.eyebrow, fontWeight: weight.bold, letterSpacing: 1.2, textTransform: "uppercase" },
  h1: { fontFamily: font.family, color: colors.ink, fontSize: font.h1, fontWeight: weight.bold, letterSpacing: -0.5 },
  sub: { fontFamily: font.family, color: colors.muted, fontSize: font.body, lineHeight: 21 },

  divider: { height: 1, backgroundColor: colors.line },
  footerNote: { fontFamily: font.family, color: colors.faint, fontSize: font.cap, textAlign: "center", marginTop: space.sm },

  btn: { borderRadius: radius.md, paddingVertical: 15, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center" },
  btnInner: { flexDirection: "row", alignItems: "center", gap: space.sm },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontFamily: font.family, fontSize: font.body, fontWeight: weight.bold, letterSpacing: 0.2 },
  btn_primary: { backgroundColor: colors.primary },
  btnText_primary: { color: colors.white },
  btn_secondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.lineStrong },
  btnText_secondary: { color: colors.ink },
  btn_ghost: { backgroundColor: "transparent" },
  btnText_ghost: { color: colors.primary },
  btn_danger: { backgroundColor: colors.danger },
  btnText_danger: { color: colors.white },

  googleG: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  googleGText: { fontFamily: font.family, color: colors.primary, fontWeight: weight.bold, fontSize: 13 },

  link: { fontFamily: font.family, color: colors.primary, fontSize: font.sub, fontWeight: weight.semibold },

  field: { gap: 6 },
  label: { fontFamily: font.family, color: colors.body, fontSize: font.sub, fontWeight: weight.semibold },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: space.md },
  input: { flex: 1, fontFamily: font.family, color: colors.ink, fontSize: font.body, paddingVertical: 13, ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}) },
  reveal: { fontFamily: font.family, color: colors.primary, fontSize: font.cap, fontWeight: weight.semibold },
  hint: { fontFamily: font.family, color: colors.muted, fontSize: font.cap },

  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingVertical: 4 },
  checkBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkTitle: { fontFamily: font.family, color: colors.ink, fontSize: font.body, fontWeight: weight.semibold },
  checkSub: { fontFamily: font.family, color: colors.muted, fontSize: font.cap, marginTop: 1 },
  flex1: { flex: 1 },

  search: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: space.lg, paddingVertical: 4 },
  searchInput: { flex: 1, fontFamily: font.family, color: colors.ink, fontSize: font.body, paddingVertical: 10, ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}) },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, ...shadow.card },
  cardPadded: { padding: space.lg, gap: space.md },

  hero: { borderRadius: radius.lg, padding: space.xl, gap: 6 },
  heroTitle: { fontFamily: font.family, fontSize: font.h3, fontWeight: weight.bold },
  heroSub: { fontFamily: font.family, fontSize: font.sub, lineHeight: 20, opacity: 0.92 },

  chip: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill },
  chipText: { fontFamily: font.family, fontSize: font.cap, fontWeight: weight.semibold },

  statusChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill },
  statusDot: { width: 7, height: 7, borderRadius: 999 },
  statusText: { fontFamily: font.family, fontSize: font.eyebrow, fontWeight: weight.bold, letterSpacing: 0.6, textTransform: "uppercase" },

  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: font.family, fontWeight: weight.bold },

  segment: { flexDirection: "row", backgroundColor: colors.lavenderSoft, borderRadius: radius.pill, padding: 4, gap: 4 },
  segmentItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: radius.pill },
  segmentItemOn: { backgroundColor: colors.secondary },
  segmentText: { fontFamily: font.family, color: colors.muted, fontSize: font.sub, fontWeight: weight.semibold },
  segmentTextOn: { color: colors.white },
  segmentBadge: { minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, backgroundColor: colors.lavender, alignItems: "center" },
  segmentBadgeOn: { backgroundColor: "rgba(255,255,255,0.3)" },
  segmentBadgeText: { fontFamily: font.family, color: colors.primary, fontSize: 10, fontWeight: weight.bold },
  segmentBadgeTextOn: { color: colors.white },

  nav: { flexDirection: "row", backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: space.sm, paddingBottom: space.md, ...shadow.nav },
  navItem: { flex: 1, alignItems: "center", gap: 4 },
  navIconWrap: { paddingHorizontal: space.lg, paddingVertical: 5, borderRadius: radius.pill },
  navIconWrapOn: { backgroundColor: colors.lavenderSoft },
  navLabel: { fontFamily: font.family, color: colors.muted, fontSize: font.eyebrow, fontWeight: weight.semibold },
  navLabelOn: { color: colors.primary, fontWeight: weight.bold },

  bubbleRow: { maxWidth: "82%", gap: 3 },
  bubbleRowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleRowTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg },
  bubbleMine: { backgroundColor: colors.secondary, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  bubbleText: { fontFamily: font.family, color: colors.ink, fontSize: font.body, lineHeight: 21 },
  bubbleTextMine: { color: colors.white },
  bubbleMeta: { fontFamily: font.family, color: colors.faint, fontSize: font.eyebrow, paddingHorizontal: 4 },

  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.line, paddingLeft: space.lg, paddingRight: 6, paddingVertical: 6 },
  composerInput: { flex: 1, fontFamily: font.family, color: colors.ink, fontSize: font.body, paddingVertical: 8, maxHeight: 110, ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}) },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },

  notice: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.md },
  noticeDanger: { backgroundColor: colors.dangerSoft },
  noticeOk: { backgroundColor: colors.successSoft },
  noticeText: { fontFamily: font.family, fontSize: font.sub, fontWeight: weight.semibold, flex: 1 },

  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.xxxl },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.lavenderSoft, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: font.family, color: colors.ink, fontSize: font.h3, fontWeight: weight.bold },
  emptySub: { fontFamily: font.family, color: colors.muted, fontSize: font.sub, textAlign: "center", maxWidth: 260, lineHeight: 20 },

  sectionLabel: { fontFamily: font.family, color: colors.muted, fontSize: font.eyebrow, fontWeight: weight.bold, letterSpacing: 1, textTransform: "uppercase" },
});
