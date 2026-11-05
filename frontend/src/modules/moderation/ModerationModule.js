import { useState } from "react";
import { Text } from "react-native";
import { apiRequest, readableError } from "../../api/client";
import { Action, Card, Field, ModuleLayout, Notice, palette } from "../../shared/ui";
import { isListingReport, validateDecision } from "./moderation.logic";

export function ModerationModule({ token }) {
  const [screen, setScreen] = useState("queue"); const [listingId, setListingId] = useState(""); const [decision, setDecision] = useState("approved"); const [reason, setReason] = useState(""); const [items, setItems] = useState([]); const [state, setState] = useState({ loading: false, error: "", message: "" });
  const run = async (operation) => { if (!token) return setState({ loading: false, error: "Se requiere una sesión de administrador.", message: "" }); setState({ loading: true, error: "", message: "" }); try { await operation(); setState({ loading: false, error: "", message: "Actualizado." }); } catch (error) { setState({ loading: false, error: readableError(error), message: "" }); } };
  const load = (path) => run(async () => setItems(await apiRequest(path, { token })));
  const decide = () => { const error = validateDecision(decision, reason); if (error) return setState({ loading: false, error, message: "" }); return run(async () => { await apiRequest(`/moderation/admin/queue/${listingId}`, { method: "PATCH", token, body: { decision, reason } }); setItems(await apiRequest("/moderation/admin/queue", { token })); }); };
  return <ModuleLayout title="Moderación de publicaciones" description="Cola exclusiva de anuncios, denuncias de contenido e historial de decisiones." tabs={[["queue", "Cola"], ["reports", "Denuncias"], ["history", "Historial"]]} active={screen} onTab={setScreen}><Card title={screen === "queue" ? "Revisión de anuncios" : screen === "reports" ? "Denuncias de publicaciones" : "Decisiones anteriores"}>
    {screen === "queue" ? <><Action label="Cargar cola" disabled={state.loading} onPress={() => load("/moderation/admin/queue")} /><Field label="ID del anuncio" value={listingId} onChangeText={setListingId} /><Field label="Decisión: approved, rejected o removed" value={decision} onChangeText={setDecision} /><Field label="Motivo" value={reason} onChangeText={setReason} /><Action label="Guardar decisión" disabled={state.loading || !listingId} onPress={decide} danger={decision === "removed"} /></> : null}
    {screen === "reports" ? <Action label="Cargar denuncias" disabled={state.loading} onPress={() => load("/moderation/admin/reports")} /> : null}{screen === "history" ? <Action label="Cargar historial" disabled={state.loading} onPress={() => load("/moderation/admin/history")} /> : null}<Notice error={state.error} message={state.message} />
    {items.filter((item) => screen !== "reports" || isListingReport(item)).map((item, index) => <Text key={item.id ?? item.listingId ?? index} style={{ color: palette.ink }}>{item.listingId}: {item.status}{item.reason ? ` — ${item.reason}` : ""}</Text>)}
  </Card></ModuleLayout>;
}
