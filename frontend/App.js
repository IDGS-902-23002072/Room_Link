import { useState } from "react";
import { Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { apiRequest } from "./src/api/client";
import { AuthModule } from "./src/modules/auth/AuthModule";
import { MessagingModule } from "./src/modules/messaging/MessagingModule";
import { ModerationModule } from "./src/modules/moderation/ModerationModule";
import { colors, font, space, weight } from "./src/shared/theme";
import { Avatar, BottomNav, Button, Card, EmptyState, Row, Screen, ScreenHeader } from "./src/shared/ui";

const NAV = [
  { key: "descubre", label: "Descubre", icon: "compass" },
  { key: "anuncios", label: "Anuncios", icon: "home" },
  { key: "chats", label: "Chats", icon: "chat" },
  { key: "perfil", label: "Perfil", icon: "person" },
];

export default function App() {
  const [session, setSession] = useState({ token: null, user: null });
  const [tab, setTab] = useState("chats");

  if (!session.user) {
    return (
      <>
        <StatusBar style="dark" />
        <AuthModule session={session} onSession={(next) => { setSession(next); setTab("chats"); }} />
      </>
    );
  }

  const nav = <BottomNav items={NAV} active={tab} onChange={setTab} />;

  const logout = async () => {
    await apiRequest("/auth/logout", { method: "POST", token: session.token }).catch(() => {});
    setSession({ token: null, user: null });
  };

  return (
    <>
      <StatusBar style="dark" />
      {tab === "chats" ? <MessagingModule token={session.token} user={session.user} nav={nav} /> : null}
      {tab === "anuncios" ? <ModerationModule token={session.token} nav={nav} /> : null}
      {tab === "descubre" ? (
        <Screen nav={nav}>
          <ScreenHeader eyebrow="RoomLink" title="Descubre" subtitle="Explora espacios y futuros roomies." />
          <EmptyState icon="compass" title="Próximamente" subtitle="El descubrimiento de anuncios es parte de otro módulo del equipo." />
        </Screen>
      ) : null}
      {tab === "perfil" ? (
        <Screen nav={nav}>
          <ScreenHeader eyebrow="RoomLink" title="Tu perfil" subtitle="Sesión y preferencias de la cuenta." />
          <Card>
            <Row gap={space.md}>
              <Avatar label={session.user.email} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.family, color: colors.ink, fontSize: font.h3, fontWeight: weight.bold }}>{session.user.email}</Text>
                <Text style={{ fontFamily: font.family, color: colors.muted, fontSize: font.sub }}>
                  {(session.user.roles || []).join(", ") || "seeker"} · {session.user.status || "activo"}
                </Text>
              </View>
            </Row>
            <Button label="Cerrar sesión" variant="secondary" onPress={logout} />
          </Card>
          <EmptyState icon="person" title="Más ajustes pronto" subtitle="Edición de perfil y preferencias viven en otro módulo del equipo." />
        </Screen>
      ) : null}
    </>
  );
}
