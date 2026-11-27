import { color } from '@/constants/roomlink';

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSesion } from '@/auth/SesionContext';
import {
  guardarCostosInmueble,
  guardarReglasInmueble,
  obtenerDetalleInmueble,
  type CostoInmuebleBackend,
  type DetalleInmuebleBackend,
  type ReglasInmuebleBackend,
} from './api';

type TabM08 = 'reglas' | 'costos' | 'zona';

const REGLAS_DEFAULT: ReglasInmuebleBackend = {
  visitsPolicy: 'Con aviso previo',
  partiesAllowed: false,
  quietHoursStart: '23:00',
  quietHoursEnd: '07:00',
  petsAllowed: false,
  smokingAllowed: false,
  commonAreasNotes: 'Mantener áreas comunes limpias y ordenadas.',
  extraRules: null,
};

const moneda = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

function extraerMonto(items: CostoInmuebleBackend[], kind: CostoInmuebleBackend['kind']): string {
  const encontrado = items.find((i) => i.kind === kind);
  return encontrado ? String(encontrado.amount) : '';
}

function extraerIncluido(items: CostoInmuebleBackend[], kind: CostoInmuebleBackend['kind']): boolean {
  return items.find((i) => i.kind === kind)?.isIncluded ?? false;
}

export function PantallaDetalleInmueble({
  listingId,
  tabInicial = 'reglas',
}: {
  listingId: string;
  tabInicial?: TabM08;
}) {
  const router = useRouter();
  const { sesion } = useSesion();

  const [tab, setTab] = useState<TabM08>(tabInicial);
  const [inmueble, setInmueble] = useState<DetalleInmuebleBackend | null>(null);
  const [reglas, setReglas] = useState<ReglasInmuebleBackend>(REGLAS_DEFAULT);

  // Desglose HU-06: servicios, depósito y mantenimiento (persistidos en room_cost_items)
  const [deposito, setDeposito] = useState('');
  const [servicios, setServicios] = useState('');
  const [serviciosIncluidos, setServiciosIncluidos] = useState(true);
  const [mantenimiento, setMantenimiento] = useState('');
  const [mantenimientoIncluido, setMantenimientoIncluido] = useState(true);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const esAnfitrion = Boolean(
    sesion?.usuario.id && inmueble && sesion.usuario.id === inmueble.hostId
      && sesion.usuario.roles.some((rol) => rol === 'host' || rol === 'admin'),
  );

  const cargar = useCallback(async () => {
    if (!listingId) {
      setError('Falta el identificador de la habitación.');
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const detalle = await obtenerDetalleInmueble(listingId);
      setInmueble(detalle);
      if (detalle.rules) {
        setReglas({
          ...REGLAS_DEFAULT,
          ...detalle.rules,
          quietHoursStart: detalle.rules.quietHoursStart?.slice(0, 5) ?? null,
          quietHoursEnd: detalle.rules.quietHoursEnd?.slice(0, 5) ?? null,
        });
      } else {
        setReglas(REGLAS_DEFAULT);
      }

      const items = detalle.costItems ?? [];
      setDeposito(extraerMonto(items, 'deposit'));
      setServicios(extraerMonto(items, 'service'));
      setServiciosIncluidos(items.some((i) => i.kind === 'service') ? extraerIncluido(items, 'service') : true);
      setMantenimiento(extraerMonto(items, 'maintenance'));
      setMantenimientoIncluido(
        items.some((i) => i.kind === 'maintenance') ? extraerIncluido(items, 'maintenance') : true,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar la información del inmueble.',
      );
    } finally {
      setCargando(false);
    }
  }, [listingId]);

  useFocusEffect(useCallback(() => {
    void cargar();
  }, [cargar]));

  const manejarGuardarReglas = async () => {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const res = await guardarReglasInmueble(listingId, reglas);
      setReglas({
        ...REGLAS_DEFAULT,
        ...res.rules,
        quietHoursStart: res.rules.quietHoursStart?.slice(0, 5) ?? null,
        quietHoursEnd: res.rules.quietHoursEnd?.slice(0, 5) ?? null,
      });
      setAviso('Reglas de la casa guardadas en el servidor.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar las reglas.');
    } finally {
      setGuardando(false);
    }
  };

  const manejarGuardarCostos = async () => {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const parseNum = (v: string) => {
        const n = Number(v.replace(/[^\d.]/g, ''));
        return Number.isFinite(n) && n >= 0 ? n : 0;
      };

      const items = [
        {
          kind: 'deposit' as const,
          concept: 'Depósito de garantía',
          amount: parseNum(deposito || String(inmueble?.monthlyRent ?? 0)),
          isIncluded: false,
          isProrated: false,
        },
        {
          kind: 'service' as const,
          concept: 'Servicios (agua, luz, internet)',
          amount: serviciosIncluidos ? 0 : parseNum(servicios),
          isIncluded: serviciosIncluidos,
          isProrated: false,
        },
        {
          kind: 'maintenance' as const,
          concept: 'Mantenimiento',
          amount: mantenimientoIncluido ? 0 : parseNum(mantenimiento),
          isIncluded: mantenimientoIncluido,
          isProrated: false,
        },
      ];

      await guardarCostosInmueble(listingId, items);
      setAviso('Desglose de costos guardado en el servidor.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los costos.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirMapaExterno = () => {
    if (!inmueble?.location) return;
    const { latitude, longitude } = inmueble.location;
    const precision = esAnfitrion ? 6 : 2;
    void Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(precision)},${longitude.toFixed(precision)}`,
    );
  };

  const costosPublicados = inmueble?.costItems ?? [];
  const depositoInformado = esAnfitrion || costosPublicados.some(({ kind }) => kind === 'deposit');
  const serviciosInformados = esAnfitrion || costosPublicados.some(({ kind }) => kind === 'service');
  const mantenimientoInformado = esAnfitrion || costosPublicados.some(({ kind }) => kind === 'maintenance');
  const renta = inmueble?.monthlyRent ?? 0;
  const montoServicios = serviciosIncluidos ? 0 : Number(servicios) || 0;
  const montoMantenimiento = mantenimientoIncluido ? 0 : Number(mantenimiento) || 0;
  const montoDeposito = deposito.trim() ? Number(deposito) || 0 : renta;
  const totalMensual = renta + montoServicios + montoMantenimiento;

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.barraSuperior}>
          <Pressable onPress={() => router.back()} style={styles.botonVolver}>
            <Text style={styles.textoVolver}>‹ Volver</Text>
          </Pressable>
          <Text style={styles.eyebrow}>ROOMLINK / 08</Text>
        </View>

        {inmueble && (
          <View>
            <Text style={styles.tituloInmueble}>{inmueble.title}</Text>
            <Text style={styles.subtitulo}>
              {moneda.format(inmueble.monthlyRent)} / mes
              {inmueble.maxRoommates
                ? ` · Hasta ${inmueble.maxRoommates} compañeros`
                : ''}
            </Text>
          </View>
        )}

        <View style={styles.tabs}>
          {(
            [
              ['reglas', 'Reglas'],
              ['costos', 'Costos claros'],
              ['zona', 'Conoce la zona'],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => {
                setTab(id);
                setAviso(null);
                setError(null);
              }}
              style={[styles.tab, tab === id && styles.tabActiva]}
            >
              <Text style={[styles.tabTexto, tab === id && styles.tabTextoActivo]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {cargando ? (
          <View style={styles.centrado}>
            <ActivityIndicator size="large" color={color.accion} />
            <Text style={styles.subtitulo}>Cargando detalles del inmueble…</Text>
          </View>
        ) : error && !inmueble ? (
          <View style={styles.avisoError}>
            <Text style={styles.textoError}>{error}</Text>
            <Pressable style={styles.botonSecundario} onPress={() => void cargar()}>
              <Text style={styles.textoSecundario}>Reintentar</Text>
            </Pressable>
          </View>
        ) : !inmueble ? null : tab === 'reglas' ? (
          <>
            <Text style={styles.tituloSeccion}>Reglas de la casa</Text>
            <Text style={styles.subtitulo}>
              Haz claras las expectativas desde el inicio.
            </Text>

            <View style={styles.tarjeta}>
              <Text style={styles.etiqueta}>Visitas</Text>
              <View style={styles.filaOpciones}>
                {['Permitidas', 'Con aviso previo', 'No permitidas'].map((op) => {
                  const activa = reglas.visitsPolicy === op;
                  return (
                    <Pressable
                      key={op}
                      disabled={!esAnfitrion}
                      onPress={() => setReglas((p) => ({ ...p, visitsPolicy: op }))}
                      style={[styles.opcion, activa && styles.opcionActiva]}
                    >
                      <Text style={[styles.textoOpcion, activa && styles.textoOpcionActiva]}>
                        {op}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.tarjeta}>
              <Text style={styles.etiqueta}>Convivencia rápida</Text>
              <View style={styles.filaOpciones}>
                {(
                  [
                    ['petsAllowed', 'Mascotas'],
                    ['smokingAllowed', 'Fumar'],
                    ['partiesAllowed', 'Fiestas'],
                  ] as const
                ).map(([campo, label]) => {
                  const activo = reglas[campo];
                  return (
                    <Pressable
                      key={campo}
                      disabled={!esAnfitrion}
                      onPress={() => setReglas((p) => ({ ...p, [campo]: !p[campo] }))}
                      style={[styles.opcion, activo && styles.opcionActiva]}
                    >
                      <Text style={[styles.textoOpcion, activo && styles.textoOpcionActiva]}>
                        {label}: {activo ? 'Sí' : 'No'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.tarjeta}>
              <Text style={styles.etiqueta}>Horario de silencio</Text>
              <View style={styles.filaOpciones}>
                {['22:00', '23:00', '00:00'].map((hora) => {
                  const activa = reglas.quietHoursStart === hora;
                  return (
                    <Pressable
                      key={hora}
                      disabled={!esAnfitrion}
                      onPress={() => setReglas((p) => ({ ...p, quietHoursStart: hora }))}
                      style={[styles.opcion, activa && styles.opcionActiva]}
                    >
                      <Text style={[styles.textoOpcion, activa && styles.textoOpcionActiva]}>
                        Desde {hora}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.tarjeta}>
              <Text style={styles.etiqueta}>Áreas comunes y reglas adicionales</Text>
              {esAnfitrion ? (
                <TextInput
                  value={reglas.extraRules ?? ''}
                  onChangeText={(extraRules) => setReglas((p) => ({ ...p, extraRules }))}
                  multiline
                  style={styles.input}
                  placeholder="Escribe reglas adicionales para tus roomies…"
                  placeholderTextColor={color.secundario}
                />
              ) : (
                <Text style={styles.valor}>
                  {reglas.extraRules || reglas.commonAreasNotes || 'Sin reglas adicionales.'}
                </Text>
              )}
            </View>

            {error && (
              <View style={styles.avisoError}>
                <Text style={styles.textoError}>{error}</Text>
              </View>
            )}
            {aviso && (
              <View style={styles.avisoExito}>
                <Text style={styles.textoExito}>{aviso}</Text>
              </View>
            )}

            {esAnfitrion && (
              <Pressable
                disabled={guardando}
                style={[styles.botonPrincipal, guardando && styles.deshabilitado]}
                onPress={() => void manejarGuardarReglas()}
              >
                <Text style={styles.textoPrincipal}>
                  {guardando ? 'Guardando…' : 'Guardar reglas'}
                </Text>
              </Pressable>
            )}
          </>
        ) : tab === 'costos' ? (
          <>
            <Text style={styles.tituloSeccion}>Costos claros</Text>
            <Text style={styles.subtitulo}>
              Renta, servicios, depósito y mantenimiento sin sorpresas.
            </Text>

            <View style={styles.tarjeta}>
              <Text style={styles.etiqueta}>Renta mensual</Text>
              <Text style={styles.valorDestacado}>{moneda.format(renta)}</Text>
            </View>

            <View style={styles.tarjeta}>
              <Text style={styles.etiqueta}>Depósito de garantía</Text>
              {esAnfitrion ? (
                <TextInput
                  value={deposito}
                  onChangeText={setDeposito}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder={`${renta} (1 mes de renta)`}
                  placeholderTextColor={color.secundario}
                />
              ) : (
                <Text style={styles.valor}>{depositoInformado ? moneda.format(montoDeposito) : 'Sin especificar'}</Text>
              )}
            </View>

            <View style={styles.tarjeta}>
              <Text style={styles.etiqueta}>Servicios (agua, luz, internet)</Text>
              {esAnfitrion ? (
                <>
                  <View style={styles.filaOpciones}>
                    <Pressable
                      onPress={() => setServiciosIncluidos(true)}
                      style={[styles.opcion, serviciosIncluidos && styles.opcionActiva]}
                    >
                      <Text
                        style={[
                          styles.textoOpcion,
                          serviciosIncluidos && styles.textoOpcionActiva,
                        ]}
                      >
                        Incluidos en renta
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setServiciosIncluidos(false)}
                      style={[styles.opcion, !serviciosIncluidos && styles.opcionActiva]}
                    >
                      <Text
                        style={[
                          styles.textoOpcion,
                          !serviciosIncluidos && styles.textoOpcionActiva,
                        ]}
                      >
                        Costo adicional
                      </Text>
                    </Pressable>
                  </View>
                  {!serviciosIncluidos && (
                    <TextInput
                      value={servicios}
                      onChangeText={setServicios}
                      keyboardType="numeric"
                      style={styles.input}
                      placeholder="Monto mensual estimado en MXN"
                      placeholderTextColor={color.secundario}
                    />
                  )}
                </>
              ) : (
                <Text style={styles.valor}>
                  {!serviciosInformados ? 'Sin especificar' : serviciosIncluidos
                    ? 'Incluidos en la renta'
                    : `${moneda.format(montoServicios)} / mes`}
                </Text>
              )}
            </View>

            <View style={styles.tarjeta}>
              <Text style={styles.etiqueta}>Mantenimiento</Text>
              {esAnfitrion ? (
                <>
                  <View style={styles.filaOpciones}>
                    <Pressable
                      onPress={() => setMantenimientoIncluido(true)}
                      style={[styles.opcion, mantenimientoIncluido && styles.opcionActiva]}
                    >
                      <Text
                        style={[
                          styles.textoOpcion,
                          mantenimientoIncluido && styles.textoOpcionActiva,
                        ]}
                      >
                        Incluido / $0
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setMantenimientoIncluido(false)}
                      style={[styles.opcion, !mantenimientoIncluido && styles.opcionActiva]}
                    >
                      <Text
                        style={[
                          styles.textoOpcion,
                          !mantenimientoIncluido && styles.textoOpcionActiva,
                        ]}
                      >
                        Costo adicional
                      </Text>
                    </Pressable>
                  </View>
                  {!mantenimientoIncluido && (
                    <TextInput
                      value={mantenimiento}
                      onChangeText={setMantenimiento}
                      keyboardType="numeric"
                      style={styles.input}
                      placeholder="Cuota mensual de mantenimiento en MXN"
                      placeholderTextColor={color.secundario}
                    />
                  )}
                </>
              ) : (
                <Text style={styles.valor}>
                  {!mantenimientoInformado ? 'Sin especificar' : mantenimientoIncluido
                    ? 'Incluido ($0)'
                    : `${moneda.format(montoMantenimiento)} / mes`}
                </Text>
              )}
            </View>

            <View style={styles.tarjetaMenta}>
              <Text style={styles.tituloMenta}>
                {serviciosInformados && mantenimientoInformado ? 'Total mensual estimado' : 'Subtotal mensual informado'} · {moneda.format(totalMensual)}
              </Text>
              <Text style={styles.textoMenta}>
                Depósito: {depositoInformado ? moneda.format(montoDeposito) : 'sin especificar'}.
                {inmueble.availableFrom
                  ? ` Disponible desde ${inmueble.availableFrom}.`
                  : ''}
              </Text>
            </View>

            {error && (
              <View style={styles.avisoError}>
                <Text style={styles.textoError}>{error}</Text>
              </View>
            )}
            {aviso && (
              <View style={styles.avisoExito}>
                <Text style={styles.textoExito}>{aviso}</Text>
              </View>
            )}

            {esAnfitrion && (
              <Pressable
                disabled={guardando}
                style={[styles.botonPrincipal, guardando && styles.deshabilitado]}
                onPress={() => void manejarGuardarCostos()}
              >
                <Text style={styles.textoPrincipal}>
                  {guardando ? 'Guardando…' : 'Guardar desglose'}
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Text style={styles.tituloSeccion}>Conoce la zona</Text>
            <Text style={styles.subtitulo}>
              Ubicación aproximada y referencias del inmueble.
            </Text>

            <View style={styles.tarjetaMapa}>
              <Text style={styles.iconoMapa}>⌖</Text>
              <Text style={styles.nombreMapa}>
                {inmueble.location ? esAnfitrion ? inmueble.location.address : 'Zona aproximada' : 'Ubicación sin especificar'}
              </Text>
              {inmueble.location && (
                <>
                  <Pressable
                    style={styles.botonSecundario}
                    onPress={abrirMapaExterno}
                  >
                    <Text style={styles.textoSecundario}>Abrir en mapa</Text>
                  </Pressable>
                </>
              )}
            </View>

            <View style={styles.tarjetaMenta}>
              <Text style={styles.tituloMenta}>Privacidad de ubicación</Text>
              <Text style={styles.textoMenta}>
                Para acordar una visita, confirma el punto de encuentro con el anfitrión.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  scroll: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 20, paddingBottom: 40, gap: 12 },
  barraSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  botonVolver: { paddingVertical: 6, paddingRight: 12 },
  textoVolver: { color: color.accion, fontSize: 15, fontWeight: '700' },
  eyebrow: { color: color.accion, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  tituloInmueble: { color: color.tinta, fontSize: 20, fontWeight: '700' },
  tituloSeccion: { color: color.tinta, fontSize: 22, fontWeight: '700' },
  subtitulo: { color: color.secundario, fontSize: 13, lineHeight: 19 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: color.menta,
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  tabActiva: { backgroundColor: color.blanco },
  tabTexto: { color: color.secundario, fontSize: 12, fontWeight: '600' },
  tabTextoActivo: { color: color.accion, fontWeight: '700' },
  centrado: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  tarjeta: {
    backgroundColor: color.blanco,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.borde,
    padding: 14,
    gap: 8,
  },
  etiqueta: { color: color.secundario, fontSize: 12, fontWeight: '700' },
  valor: { color: color.tinta, fontSize: 14, lineHeight: 20 },
  valorDestacado: { color: color.accion, fontSize: 24, fontWeight: '800' },
  filaOpciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  opcion: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F1EAF3',
  },
  opcionActiva: { backgroundColor: color.accion },
  textoOpcion: { color: color.accion, fontSize: 12, fontWeight: '600' },
  textoOpcionActiva: { color: color.blanco },
  input: {
    color: color.tinta,
    fontSize: 14,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#E5DAE9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  tarjetaMenta: {
    backgroundColor: color.menta,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  tituloMenta: { color: '#1F4B43', fontSize: 15, fontWeight: '700' },
  textoMenta: { color: '#2E5D55', fontSize: 13, lineHeight: 19 },
  tarjetaMapa: {
    backgroundColor: '#EFE4F2',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  iconoMapa: { fontSize: 32 },
  nombreMapa: {
    color: color.tinta,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  botonPrincipal: {
    backgroundColor: color.accion,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  textoPrincipal: { color: color.blanco, fontSize: 15, fontWeight: '700' },
  botonSecundario: {
    backgroundColor: color.menta,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  textoSecundario: { color: color.accion, fontSize: 13, fontWeight: '700' },
  deshabilitado: { opacity: 0.6 },
  avisoExito: { backgroundColor: '#DCF0E8', borderRadius: 12, padding: 12 },
  textoExito: { color: '#1F6F60', fontSize: 13, fontWeight: '600' },
  avisoError: {
    backgroundColor: color.rosa,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  textoError: { color: color.rosaTexto, fontSize: 13, fontWeight: '600' },
});
