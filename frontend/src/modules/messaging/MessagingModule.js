import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { apiRequest, readableError } from "../../api/client";
import { colors, font, radius, space, weight } from "../../shared/theme";
import { Icon } from "../../shared/icons";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  HeroCard,
  LinkText,
  MessageBubble,
  MessageInput,
  Notice,
  Row,
  Screen,
  ScreenHeader,
  SearchField,
  SegmentedTabs,
  StatusChip,
  TextField,
} from "../../shared/ui";
import { normalizeHistory, validateMessage } from "./messaging.logic";

const peerName = (item) =>
  item?.peer?.fullName || item?.peer?.name || item?.peer?.email || item?.counterpart?.email || item?.name || "Conexión";
const previewOf = (item) => item?.lastMessage?.body || item?.preview || "Conversación iniciada";
const roomIdOf = (item) => item?.room?.id || item?.roomId || item?.id;
const affinityOf = (x) => (x?.affinity != null ? `${x.affinity}% afín` : x?.compatibility != null ? `${x.compatibility}% afín` : null);
const unreadOf = (item) => item?.unread || item?.unreadCount || 0;

export function MessagingModule({ token, user, nav }) {
  const [view, setView] = useState("inbox");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [messages, setMessages] = useState([]);
  const [context, setContext] = useState(null);
  const [active, setActive] = useState(null);
  const [manualId, setManualId] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState({ loading: false, error: "", message: "" });

  const run = async (operation) => {
    if (!token) return setState({ loading: false, error: "Inicia sesión para abrir tus conversaciones.", message: "" });
    setState({ loading: true, error: "", message: "" });
    try {
      await operation();
      setState({ loading: false, error: "", message: "" });
    } catch (error) {
      setState({ loading: false, error: readableError(error), message: "" });
    }
  };

  const loadInbox = () =>
    run(async () => {
      setItems(await apiRequest("/messages", { token }));
      setLoaded(true);
    });

  const openRoom = (item) => {
    const roomId = typeof item === "string" ? item : roomIdOf(item);
    if (!roomId) return setState({ loading: false, error: "No se encontró la sala.", message: "" });
    setActive({ roomId, title: typeof item === "string" ? `Sala ${item}` : peerName(item), subtitle: typeof item === "string" ? "" : affinityOf(item) || "" });
    setView("room");
    run(async () => {
      setMessages(normalizeHistory(await apiRequest(`/messages/rooms/${roomId}/messages`, { token })));
      await apiRequest(`/messages/rooms/${roomId}/read`, { method: "PATCH", token }).catch(() => {});
    });
  };

  const send = () => {
    const result = validateMessage(body);
    if (result.error) return setState({ loading: false, error: result.error, message: "" });
    return run(async () => {
      const message = await apiRequest(`/messages/rooms/${active.roomId}/messages`, { method: "POST", token, body: { body: result.body } });
      setMessages((current) => normalizeHistory([...current, message]));
      setBody("");
    });
  };

  const openContext = () =>
    run(async () => {
      setContext(await apiRequest(`/messages/rooms/${active.roomId}/context`, { token }));
      setView("context");
    });

  const isMine = (m) => m?.mine === true || m?.direction === "out" || [m?.senderId, m?.authorId, m?.userId, m?.fromUserId].includes(user?.id);

  const filtered = items.filter((item) => {
    if (filter === "unread" && !unreadOf(item)) return false;
    if (query && !`${peerName(item)} ${previewOf(item)}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const unreadTotal = items.reduce((sum, item) => sum + (unreadOf(item) ? 1 : 0), 0);

  /* ----------------------------------------------------------- Inbox */
  if (view === "inbox") {
    return (
      <Screen nav={nav}>
        <ScreenHeader eyebrow="RoomLink / 10" title="Tus conversaciones" subtitle="Conexiones que se convierten en hogar." />
        <SearchField value={query} onChangeText={setQuery} placeholder="Buscar conversación" />
        <SegmentedTabs
          active={filter}
          onChange={setFilter}
          tabs={[
            { key: "all", label: "Todas" },
            { key: "unread", label: "No leídos", badge: unreadTotal || undefined },
          ]}
        />
        {!loaded ? <Button label={state.loading ? "Cargando…" : "Cargar bandeja"} loading={state.loading} onPress={loadInbox} /> : null}
        <Notice error={state.error} message={state.message} />

        {loaded && filtered.length === 0 ? (
          <EmptyState icon="chat" title="Sin conversaciones todavía" subtitle="Cuando una conexión sea aceptada, la verás aquí." />
        ) : null}

        {filtered.map((item, index) => {
          const unread = unreadOf(item);
          return (
            <Card key={roomIdOf(item) ?? index} onPress={() => openRoom(item)}>
              <Row gap={space.md} align="flex-start">
                <Avatar label={peerName(item)} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Row justify="space-between">
                    <Text style={inbox.name}>{peerName(item)}</Text>
                    <Row gap={6}>
                      {item?.lastMessage?.time ? <Text style={inbox.time}>{item.lastMessage.time}</Text> : null}
                      {unread ? (
                        <View style={inbox.badge}>
                          <Text style={inbox.badgeText}>{unread} NUEVOS</Text>
                        </View>
                      ) : null}
                    </Row>
                  </Row>
                  <Text style={inbox.preview} numberOfLines={1}>{previewOf(item)}</Text>
                  {affinityOf(item) ? <Text style={inbox.meta}>{affinityOf(item)}</Text> : null}
                </View>
              </Row>
            </Card>
          );
        })}

        <HeroCard tone="teal" title="Conversaciones con consentimiento" subtitle="Solo tus conexiones aceptadas pueden escribirte." />

        {showManual ? (
          <Card>
            <TextField label="Abrir conversación por ID de sala" placeholder="room-id" value={manualId} onChangeText={setManualId} />
            <Button label="Abrir sala" variant="secondary" disabled={!manualId} onPress={() => openRoom(manualId)} />
          </Card>
        ) : (
          <LinkText tone="muted" align="center" onPress={() => setShowManual(true)}>Abrir una conversación por ID</LinkText>
        )}
      </Screen>
    );
  }

  /* ----------------------------------------------------------- Room */
  if (view === "room") {
    return (
      <Screen scroll={false} nav={nav}>
        <View style={{ flex: 1, paddingHorizontal: space.xl, paddingTop: space.lg }}>
          <ScreenHeader
            eyebrow="En línea"
            title={active?.title || "Conversación"}
            subtitle={active?.subtitle || "Habitación compartida"}
            onBack={() => setView("inbox")}
          />
          <TouchableOpacity onPress={openContext} style={room.profileLink} activeOpacity={0.7}>
            <Text style={room.profileLinkText}>Ver perfil y espacio compartido</Text>
            <Icon name="chevronRight" size={18} color={colors.primary} />
          </TouchableOpacity>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={room.thread} showsVerticalScrollIndicator={false}>
            {messages.length === 0 ? (
              <EmptyState icon="chat" title="Aún no hay mensajes" subtitle="Rompe el hielo: salúdale y coordina una visita." />
            ) : null}
            {messages.map((m, index) => (
              <MessageBubble
                key={m.id ?? index}
                mine={isMine(m)}
                text={m.body}
                meta={index === messages.length - 1 && isMine(m) ? `${m.readAt || m.status === "read" ? "Leído" : "Enviado"}` : null}
              />
            ))}
            <Notice error={state.error} message={state.message} />
          </ScrollView>

          <View style={{ paddingVertical: space.md }}>
            <MessageInput value={body} onChangeText={setBody} onSend={send} disabled={state.loading || !body.trim()} />
          </View>
        </View>
      </Screen>
    );
  }

  /* ----------------------------------------------------------- Context */
  const peer = context?.peer || context?.counterpart || {};
  const listing = context?.listing || context?.room || {};
  const connection = context?.connection || {};
  return (
    <Screen nav={nav}>
      <ScreenHeader eyebrow="RoomLink / 10" title="Detalles de la conexión" subtitle="Información de la conversación" onBack={() => setView("room")} />
      <Card>
        <Row gap={space.md}>
          <Avatar label={peer.fullName || peer.name || peer.email || active?.title || "Conexión"} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={ctx.name}>{peer.fullName || peer.name || active?.title || "Conexión"}</Text>
            <Text style={ctx.meta}>{affinityOf(peer) || affinityOf(context) || "Perfil de la conexión"} · Ver perfil completo</Text>
          </View>
        </Row>
      </Card>

      <Card padded={false}>
        <View style={ctx.cover}>
          <Icon name="home" size={34} color={colors.tealDeep} />
          <Text style={ctx.coverText}>Vista ilustrativa del espacio</Text>
        </View>
        <View style={{ padding: space.lg, gap: space.sm }}>
          <Text style={ctx.listingTitle}>{listing.title || "Habitación compartida"}</Text>
          <Text style={ctx.meta}>{listing.monthlyRent ? `$${listing.monthlyRent} MXN / mes` : "Precio por confirmar"} · Ver anuncio</Text>
        </View>
      </Card>

      <Card>
        <StatusChip label={connection.status === "accepted" || !connection.status ? "Conexión aceptada" : connection.status} tone="success" />
        <Text style={ctx.meta}>{connection.acceptedAt || connection.date || "Conexión activa"}</Text>
        <Button label="Ver acuerdos compartidos" variant="secondary" onPress={() => {}} />
      </Card>

      <Notice error={state.error} message={state.message} />
      <Row gap={space.lg} justify="center">
        <LinkText tone="muted" onPress={() => {}}>Silenciar</LinkText>
        <LinkText tone="muted" onPress={() => {}}>Bloquear</LinkText>
        <LinkText onPress={() => {}}>Reportar</LinkText>
      </Row>
    </Screen>
  );
}

const inbox = {
  name: { fontFamily: font.family, color: colors.ink, fontSize: font.body, fontWeight: weight.bold },
  time: { fontFamily: font.family, color: colors.faint, fontSize: font.eyebrow, fontWeight: weight.semibold },
  badge: { backgroundColor: colors.secondary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { fontFamily: font.family, color: colors.white, fontSize: 9, fontWeight: weight.bold, letterSpacing: 0.4 },
  preview: { fontFamily: font.family, color: colors.body, fontSize: font.sub },
  meta: { fontFamily: font.family, color: colors.muted, fontSize: font.cap },
};

const room = {
  profileLink: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: space.sm },
  profileLinkText: { fontFamily: font.family, color: colors.primary, fontSize: font.sub, fontWeight: weight.semibold },
  thread: { gap: space.md, paddingVertical: space.md },
};

const ctx = {
  name: { fontFamily: font.family, color: colors.ink, fontSize: font.h3, fontWeight: weight.bold },
  meta: { fontFamily: font.family, color: colors.muted, fontSize: font.sub },
  cover: { height: 140, backgroundColor: colors.tealSurface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: 6 },
  coverText: { fontFamily: font.family, color: colors.tealDeep, fontSize: font.cap, fontWeight: weight.semibold },
  listingTitle: { fontFamily: font.family, color: colors.ink, fontSize: font.body, fontWeight: weight.bold },
};
