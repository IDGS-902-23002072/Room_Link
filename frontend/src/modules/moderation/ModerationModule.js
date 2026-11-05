import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { apiRequest, readableError } from "../../api/client";
import { colors, font, radius, space, weight } from "../../shared/theme";
import { Icon } from "../../shared/icons";
import {
  Button,
  Card,
  EmptyState,
  Label,
  LinkText,
  Notice,
  Row,
  Screen,
  ScreenHeader,
  SearchField,
  SegmentedTabs,
  StatusChip,
  TextField,
} from "../../shared/ui";
import { isListingReport, validateDecision } from "./moderation.logic";

const listingLabel = (x) => x?.title || x?.listingTitle || "Anuncio";
const folioOf = (x) => x?.folio || (x?.listingId ? `#${String(x.listingId).slice(0, 6).toUpperCase()}` : "#—");
const rentOf = (x) => (x?.monthlyRent ? `$${x.monthlyRent} / mes` : "Precio por confirmar");

const historyTone = (status) =>
  status === "approved" ? "success" : status === "rejected" ? "danger" : status === "removed" ? "warning" : "neutral";
const historyLabel = (status) =>
  status === "approved" ? "Aprobado" : status === "rejected" ? "Rechazado" : status === "removed" ? "Dado de baja" : status || "Pendiente";

export function ModerationModule({ token, nav }) {
  const [section, setSection] = useState("queue");
  const [queue, setQueue] = useState([]);
  const [reports, setReports] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState("approved");
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");
  const [histFilter, setHistFilter] = useState("all");
  const [loaded, setLoaded] = useState({ queue: false, reports: false, history: false });
  const [state, setState] = useState({ loading: false, error: "", message: "" });

  const run = async (operation) => {
    if (!token) return setState({ loading: false, error: "Se requiere una sesión de administrador.", message: "" });
    setState({ loading: true, error: "", message: "" });
    try {
      const msg = await operation();
      setState({ loading: false, error: "", message: msg || "" });
    } catch (error) {
      setState({ loading: false, error: readableError(error), message: "" });
    }
  };

  const loadQueue = () => run(async () => { setQueue(await apiRequest("/moderation/admin/queue", { token })); setLoaded((l) => ({ ...l, queue: true })); });
  const loadReports = () => run(async () => { setReports(await apiRequest("/moderation/admin/reports", { token })); setLoaded((l) => ({ ...l, reports: true })); });
  const loadHistory = () => run(async () => { setHistory(await apiRequest("/moderation/admin/history", { token })); setLoaded((l) => ({ ...l, history: true })); });

  useEffect(() => {
    if (!token) return;
    if (section === "queue" && !loaded.queue) loadQueue();
    if (section === "reports" && !loaded.reports) loadReports();
    if (section === "history" && !loaded.history) loadHistory();
  }, [section, token]);

  const decide = (listingId, nextDecision, nextReason) => {
    const error = validateDecision(nextDecision, nextReason);
    if (error) return setState({ loading: false, error, message: "" });
    return run(async () => {
      await apiRequest(`/moderation/admin/queue/${listingId}`, { method: "PATCH", token, body: { decision: nextDecision, reason: nextReason } });
      setQueue(await apiRequest("/moderation/admin/queue", { token }));
      setSelected(null);
      setReason("");
      setDecision("approved");
      return "Decisión registrada.";
    });
  };

  /* ----------------------------------------------------------- Cola */
  const renderQueue = () => {
    if (selected) {
      const needsReason = decision !== "approved";
      return (
        <Card>
          <Label>Revisar {folioOf(selected)}</Label>
          <Text style={mod.title}>{listingLabel(selected)}</Text>
          <Text style={mod.meta}>{rentOf(selected)}</Text>
          <View style={{ gap: space.sm, marginTop: 4 }}>
            <SegmentedTabs
              active={decision}
              onChange={setDecision}
              tabs={[
                { key: "approved", label: "Aprobar" },
                { key: "rejected", label: "Corregir" },
                { key: "removed", label: "Retirar" },
              ]}
            />
            {needsReason ? <TextField label="Motivo" placeholder="Explica la decisión al anunciante" value={reason} onChangeText={setReason} /> : null}
          </View>
          <Notice error={state.error} message={state.message} />
          <Button
            label={decision === "removed" ? "Retirar publicación" : decision === "rejected" ? "Solicitar correcciones" : "Aprobar anuncio"}
            variant={decision === "removed" ? "danger" : "primary"}
            loading={state.loading}
            onPress={() => decide(selected.listingId || selected.id, decision, reason)}
          />
          <LinkText tone="muted" align="center" onPress={() => { setSelected(null); setReason(""); setDecision("approved"); }}>Cancelar</LinkText>
        </Card>
      );
    }
    return (
      <>
        {!loaded.queue ? <Button label={state.loading ? "Cargando…" : "Cargar cola"} loading={state.loading} onPress={loadQueue} /> : null}
        <Notice error={state.error} message={state.message} />
        {loaded.queue && queue.length === 0 ? <EmptyState icon="check" title="Cola al día" subtitle="No hay anuncios pendientes de revisión." /> : null}
        {queue.map((item, index) => (
          <Card key={item.listingId ?? item.id ?? index}>
            <View style={mod.cover}><Icon name="home" size={30} color={colors.primary} /><Text style={mod.coverText}>Vista ilustrativa</Text></View>
            <StatusChip label={`Pendiente · ${folioOf(item)}`} tone="lavender" />
            <Text style={mod.title}>{listingLabel(item)}</Text>
            <Text style={mod.meta}>{rentOf(item)}{item.publishedAt ? ` · ${item.publishedAt}` : ""}</Text>
            <Button label={`Revisar anuncio ${folioOf(item)}`} onPress={() => setSelected(item)} />
          </Card>
        ))}
      </>
    );
  };

  /* ----------------------------------------------------------- Denuncias */
  const renderReports = () => {
    const listingReports = reports.filter(isListingReport);
    return (
      <>
        {!loaded.reports ? <Button label={state.loading ? "Cargando…" : "Cargar denuncias"} loading={state.loading} onPress={loadReports} /> : null}
        <Notice error={state.error} message={state.message} />
        {loaded.reports && listingReports.length === 0 ? <EmptyState icon="shield" title="Sin denuncias" subtitle="No hay anuncios denunciados por revisar." /> : null}
        {listingReports.map((report, index) => (
          <Card key={report.id ?? report.listingId ?? index}>
            <StatusChip label={`${report.count ? `${report.count} denuncias` : "Denuncia"}`} tone="danger" />
            <Text style={mod.title}>{report.reason || report.title || "Anuncio denunciado"}</Text>
            {report.detail ? <Text style={mod.meta}>{report.detail}</Text> : null}

            <View style={mod.block}>
              <Label>Contenido denunciado</Label>
              <Text style={mod.blockText}>{listingLabel(report)} · {folioOf(report)}</Text>
            </View>
            {report.evidence ? (
              <View style={mod.block}>
                <Label>Evidencia del reporte</Label>
                <Text style={mod.blockText}>{report.evidence}</Text>
              </View>
            ) : null}

            <Button label="Retirar publicación" variant="danger" loading={state.loading} onPress={() => decide(report.listingId, "removed", report.reason || "Reporte confirmado")} />
            <Button label="Solicitar correcciones" variant="secondary" loading={state.loading} onPress={() => decide(report.listingId, "rejected", report.reason || "Información no verificable")} />
            <LinkText tone="muted" align="center" onPress={() => {}}>Descartar denuncia</LinkText>
          </Card>
        ))}
      </>
    );
  };

  /* ----------------------------------------------------------- Historial */
  const renderHistory = () => {
    const rows = history.filter((h) => {
      const status = h.decision || h.status;
      if (histFilter === "approved" && status !== "approved") return false;
      if (histFilter === "rejected" && status === "approved") return false;
      if (query && !`${listingLabel(h)} ${folioOf(h)}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
    return (
      <>
        <SearchField value={query} onChangeText={setQuery} placeholder="Buscar por anuncio o folio" />
        <SegmentedTabs
          active={histFilter}
          onChange={setHistFilter}
          tabs={[
            { key: "all", label: "Todos" },
            { key: "approved", label: "Aprobados" },
            { key: "rejected", label: "Rechazados" },
          ]}
        />
        {!loaded.history ? <Button label={state.loading ? "Cargando…" : "Cargar historial"} loading={state.loading} onPress={loadHistory} /> : null}
        <Notice error={state.error} message={state.message} />
        {loaded.history && rows.length === 0 ? <EmptyState icon="chart" title="Sin decisiones" subtitle="Aquí queda el registro de cada moderación." /> : null}
        {rows.map((h, index) => {
          const status = h.decision || h.status;
          return (
            <Card key={h.id ?? index}>
              <Row justify="space-between">
                <StatusChip label={historyLabel(status)} tone={historyTone(status)} />
                {h.date ? <Text style={mod.meta}>{h.date}</Text> : null}
              </Row>
              <Text style={mod.title}>{listingLabel(h)}</Text>
              <Text style={mod.meta}>Folio {folioOf(h)}{h.moderator ? ` · ${h.moderator}` : ""}{h.reason ? ` · ${h.reason}` : ""}</Text>
            </Card>
          );
        })}
      </>
    );
  };

  const headers = {
    queue: { title: "Anuncios por revisar", subtitle: "Administración · Calidad de la oferta" },
    reports: { title: "Denuncias de anuncios", subtitle: "Administración · Reportes de contenido" },
    history: { title: "Historial de moderación", subtitle: "Administración · Registro de decisiones" },
  };
  const h = headers[section];

  return (
    <Screen nav={nav}>
      <ScreenHeader eyebrow="RoomLink / Administración" title={h.title} subtitle={h.subtitle} />
      <SegmentedTabs
        active={section}
        onChange={(next) => { setSection(next); setSelected(null); setState({ loading: false, error: "", message: "" }); }}
        tabs={[
          { key: "queue", label: "Cola" },
          { key: "reports", label: "Denuncias" },
          { key: "history", label: "Historial" },
        ]}
      />
      {section === "queue" ? renderQueue() : null}
      {section === "reports" ? renderReports() : null}
      {section === "history" ? renderHistory() : null}
    </Screen>
  );
}

const mod = {
  title: { fontFamily: font.family, color: colors.ink, fontSize: font.h3, fontWeight: weight.bold },
  meta: { fontFamily: font.family, color: colors.muted, fontSize: font.sub },
  cover: { height: 120, backgroundColor: colors.primarySoft, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: 6 },
  coverText: { fontFamily: font.family, color: colors.primary, fontSize: font.cap, fontWeight: weight.semibold },
  block: { gap: 4, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  blockText: { fontFamily: font.family, color: colors.body, fontSize: font.sub },
};
