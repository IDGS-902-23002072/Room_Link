import { useState } from "react";
import { Text } from "react-native";
import { apiRequest, readableError } from "../../api/client";
import { Action, Card, Field, ModuleLayout, Notice, palette } from "../../shared/ui";
import { normalizeHistory, validateMessage } from "./messaging.logic";

export function MessagingModule({ token }) {
  const [screen, setScreen] = useState("inbox"); const [roomId, setRoomId] = useState(""); const [body, setBody] = useState(""); const [items, setItems] = useState([]); const [context, setContext] = useState(null); const [state, setState] = useState({ loading: false, error: "", message: "" });
  const run = async (operation) => { if (!token) return setState({ loading: false, error: "Inicia sesión para abrir el chat.", message: "" }); setState({ loading: true, error: "", message: "" }); try { await operation(); setState({ loading: false, error: "", message: "Actualizado." }); } catch (error) { setState({ loading: false, error: readableError(error), message: "" }); } };
  const loadInbox = () => run(async () => setItems(await apiRequest("/messages", { token })));
  const loadRoom = () => run(async () => { setItems(normalizeHistory(await apiRequest(`/messages/rooms/${roomId}/messages`, { token }))); await apiRequest(`/messages/rooms/${roomId}/read`, { method: "PATCH", token }); });
  const send = () => { const result = validateMessage(body); if (result.error) return setState({ loading: false, error: result.error, message: "" }); return run(async () => { const message = await apiRequest(`/messages/rooms/${roomId}/messages`, { method: "POST", token, body: { body: result.body } }); setItems((current) => normalizeHistory([...current, message])); setBody(""); }); };
  const loadContext = () => run(async () => setContext(await apiRequest(`/messages/rooms/${roomId}/context`, { token })));
  return <ModuleLayout title="Mensajería instantánea" description="Conversaciones privadas habilitadas solo por conexión o postulación aceptada." tabs={[["inbox", "Bandeja"], ["room", "Sala"], ["context", "Información"]]} active={screen} onTab={setScreen}><Card title={screen === "inbox" ? "Tus conversaciones" : screen === "room" ? "Sala de chat" : "Perfil y propiedad"}>
    {screen !== "inbox" ? <Field label="ID de la sala" value={roomId} onChangeText={setRoomId} /> : null}
    {screen === "inbox" ? <Action label="Cargar bandeja" disabled={state.loading} onPress={loadInbox} /> : null}
    {screen === "room" ? <><Action label="Cargar historial" disabled={state.loading || !roomId} onPress={loadRoom} /><Field label="Mensaje" multiline value={body} onChangeText={setBody} /><Action label="Enviar" disabled={state.loading || !roomId} onPress={send} /></> : null}
    {screen === "context" ? <Action label="Cargar información" disabled={state.loading || !roomId} onPress={loadContext} /> : null}<Notice error={state.error} message={state.message} />
    {screen !== "context" ? items.map((item, index) => <Text key={item.id ?? item.room?.id ?? index} style={{ color: palette.ink }}>{item.body ?? item.lastMessage?.body ?? `Conversación ${item.room?.id ?? ""}`}</Text>) : null}{context ? <Text style={{ color: palette.ink }}>{JSON.stringify(context, null, 2)}</Text> : null}
  </Card></ModuleLayout>;
}
