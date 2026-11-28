import { color } from '@/constants/roomlink';

import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { EntradaValidada } from '@/modulos/comunes/EntradaValidada';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  guardarCostosInmueble,
  guardarReglasInmueble,
  obtenerDetalleInmueble,
  type CostoInmuebleBackend,
  type ReglasInmuebleBackend,
} from '@/modulos/inmueble/api';
import { publicarAnuncio } from './api';

const initialRules: ReglasInmuebleBackend = {
  petsAllowed: false, smokingAllowed: false, partiesAllowed: false,
  visitsPolicy: null, quietHoursStart: null, quietHoursEnd: null,
  commonAreasNotes: null, extraRules: null,
};
const costTypes = [
  { kind: 'service', concept: 'Servicios' },
  { kind: 'deposit', concept: 'Depósito' },
  { kind: 'maintenance', concept: 'Mantenimiento' },
] as const;
const switches = [
  ['petsAllowed', 'Permitir mascotas'],
  ['smokingAllowed', 'Permitir fumar'],
  ['partiesAllowed', 'Permitir fiestas'],
] as const;
const textRules = [
  ['visitsPolicy', 'Política de visitas'],
  ['commonAreasNotes', 'Uso de áreas comunes'],
  ['extraRules', 'Otras reglas'],
] as const;

export default function PantallaReglasCostos({ id, onVolver, onPublicado }: {
  id: string;
  onVolver: () => void;
  onPublicado: () => void;
}) {
  const [rules, setRules] = useState(initialRules);
  const [existing, setExisting] = useState<CostoInmuebleBackend[] | null>(null);
  const [amounts, setAmounts] = useState<Partial<Record<(typeof costTypes)[number]['kind'], string>>>({});
  const [noExtra, setNoExtra] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    obtenerDetalleInmueble(id).then((listing) => {
      if (!active) return;
      setRules(listing.rules ?? initialRules);
      setExisting(listing.costItems);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el borrador.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id, retry]);

  async function publish() {
    if (busy || !existing) return;
    setError('');
    const entered = costTypes.filter(({ kind }) => amounts[kind]?.trim());
    const normalize = (value: string) => value.trim().replace(',', '.');
    if (entered.some(({ kind }) => !/^\d{1,8}(\.\d{1,2})?$/.test(normalize(amounts[kind] ?? '')))) {
      setError('Escribe montos válidos en MXN, con hasta dos decimales.');
      return;
    }
    const added = entered.map(({ kind, concept }) => ({
      kind, concept, amount: Number(normalize(amounts[kind] ?? '')), isIncluded: false, isProrated: false,
    }));
    const costs: CostoInmuebleBackend[] = [
      ...existing.filter((item) => !entered.some(({ kind }) => kind === item.kind)),
      ...added,
    ];
    if (!costs.length && !noExtra) {
      setError('Indica un costo o confirma que no hay cargos adicionales.');
      return;
    }
    if (!costs.length) {
      costs.push({ kind: 'other', concept: 'Sin cargos adicionales', amount: 0, isIncluded: true, isProrated: false });
    }
    setBusy(true);
    try {
      await guardarReglasInmueble(id, rules);
      await guardarCostosInmueble(id, costs);
      await publicarAnuncio(id);
      onPublicado();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo publicar la habitación.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable disabled={busy} accessibilityRole="button" onPress={onVolver}>
          <Text style={styles.link}>‹ Volver a mis habitaciones</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Reglas y costos</Text>
        {loading && <ActivityIndicator color="#246451" />}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {!loading && !existing && <Pressable accessibilityRole="button" style={styles.action} onPress={() => {
          setError('');
          setLoading(true);
          setRetry((value) => value + 1);
        }}><Text style={styles.actionText}>Reintentar</Text></Pressable>}
        {existing && <>
          <View style={styles.panel}>
            <Text style={styles.heading}>Reglas de convivencia</Text>
            {switches.map(([key, label]) => <View key={key} style={styles.row}>
              <Text>{label}</Text>
              <Switch accessibilityLabel={label} disabled={busy} value={rules[key]}
                onValueChange={(value) => setRules((current) => ({ ...current, [key]: value }))} />
            </View>)}
            {textRules.map(([key, label]) => <View key={key} style={styles.field}>
              <Text>{label}</Text>
              <EntradaValidada accessibilityLabel={label} editable={!busy} style={styles.input} value={rules[key] ?? ''}
                onChangeText={(text) => setRules((current) => ({ ...current, [key]: text }))} />
            </View>)}
          </View>
          <View style={styles.panel}>
            <Text style={styles.heading}>Costos adicionales en MXN</Text>
            {existing.length > 0 && <Text>Los conceptos que ya guardaste se conservan si dejas el campo vacío.</Text>}
            {existing.map((item, index) => <Text key={item.id ?? index}>{item.concept} · ${item.amount.toFixed(2)}</Text>)}
            {costTypes.map(({ kind, concept }) => <View key={kind} style={styles.field}>
              <Text>{concept}</Text>
              <EntradaValidada accessibilityLabel={concept} editable={!busy && !noExtra} keyboardType="decimal-pad"
                value={amounts[kind] ?? ''} style={styles.input}
                onChangeText={(text) => setAmounts((current) => ({ ...current, [kind]: text }))} />
            </View>)}
            {!existing.length && <View style={styles.row}>
              <Text>Sin cargos adicionales</Text>
              <Switch accessibilityLabel="Sin cargos adicionales" disabled={busy} value={noExtra}
                onValueChange={(value) => { setNoExtra(value); if (value) setAmounts({}); }} />
            </View>}
          </View>
          <Pressable accessibilityRole="button" disabled={busy} onPress={publish} style={styles.action}>
            <Text style={styles.actionText}>{busy ? 'Guardando…' : 'Guardar y publicar habitación'}</Text>
          </Pressable>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.blanco, paddingBottom: Platform.OS === 'web' ? 76 : 0 },
  scroll: { flex: 1 },
  content: { padding: 22, gap: 16 },
  title: { fontSize: 25, fontWeight: '700', color: color.tinta },
  heading: { fontSize: 17, fontWeight: '700', color: color.tinta },
  panel: { backgroundColor: color.blanco, borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  field: { gap: 6 },
  input: { borderWidth: 1, borderColor: '#D8CFE0', borderRadius: 8, padding: 10 },
  action: { backgroundColor: color.menta, padding: 13, borderRadius: 12, alignItems: 'center' },
  actionText: { color: '#214E42', fontWeight: '700' },
  link: { color: '#644E70', paddingVertical: 5 },
  error: { color: '#9B3B53', backgroundColor: '#FCEAF0', padding: 10, borderRadius: 8 },
});
