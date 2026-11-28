import { color } from '@/constants/roomlink';

import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarcaRoomLink } from '@/components/MarcaRoomLink';
import { cerrarSesion } from '@/auth/api-auth';
import { useSesion } from '@/auth/SesionContext';

import {
  actualizarPerfil,
  actualizarInstagram,
  crearPerfil,
  guardarPerfilLocal,
  leerPerfilLocal,
  obtenerPerfil,
  PerfilNoEncontrado,
  perfilDesdeApi,
  type PerfilFormulario,
} from './api';
import { CampoPerfil } from './componentes/CampoPerfil';
import { Accion, Tarjeta, Texto } from '../comunes/InterfazModulo';
import { esTelefonoNacional, normalizarTelefonoGuardado } from '../comunes/validacionCampos';

const MAX_BIOGRAFIA = 300;

const PERFIL_VACIO: PerfilFormulario = {
  nombre: '',
  edad: '',
  ocupacion: '',
  biografia: '',
  zona: '',
  presupuestoMin: '',
  presupuestoMax: '',
};

function validarPerfil(perfil: PerfilFormulario): string | null {
  const nombre = perfil.nombre.trim();
  if (nombre.length < 2 || nombre.length > 50) {
    return 'El nombre debe tener entre 2 y 50 caracteres.';
  }

  const edadTexto = perfil.edad.trim();
  if (!/^\d+$/.test(edadTexto)) {
    return 'La edad debe ser un número entero.';
  }
  const edad = Number(edadTexto);
  if (edad < 18 || edad > 99) {
    return 'La edad debe estar entre 18 y 99 años.';
  }

  if (perfil.ocupacion.trim().length > 160) {
    return 'La ocupación no puede superar los 160 caracteres.';
  }

  if (perfil.biografia.length > MAX_BIOGRAFIA) {
    return `La biografía no puede superar los ${MAX_BIOGRAFIA} caracteres.`;
  }

  const telefono = perfil.telefono?.trim();
  if (telefono && !esTelefonoNacional(telefono)) {
    return 'Escribe un número de teléfono de México de 10 dígitos.';
  }

  const presupuestoMin = perfil.presupuestoMin.trim();
  const presupuestoMax = perfil.presupuestoMax.trim();
  if (presupuestoMin && !/^\d+$/.test(presupuestoMin)) {
    return 'El presupuesto mínimo debe ser un monto válido.';
  }
  if (presupuestoMax && !/^\d+$/.test(presupuestoMax)) {
    return 'El presupuesto máximo debe ser un monto válido.';
  }
  if (
    presupuestoMin &&
    presupuestoMax &&
    Number(presupuestoMin) > Number(presupuestoMax)
  ) {
    return 'El presupuesto mínimo no puede ser mayor que el máximo.';
  }

  return null;
}

function normalizarPerfil(perfil: PerfilFormulario): PerfilFormulario {
  return {
    nombre: perfil.nombre.trim(),
    edad: perfil.edad.trim(),
    ocupacion: perfil.ocupacion.trim(),
    biografia: perfil.biografia.trim(),
    zona: perfil.zona.trim(),
    presupuestoMin: perfil.presupuestoMin.trim(),
    presupuestoMax: perfil.presupuestoMax.trim(),
    ciudad: perfil.ciudad?.trim(),
    telefono: perfil.telefono?.trim(),
    instagram: perfil.instagram?.trim(),
  };
}

function edadDesdeNacimiento(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const fecha = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) return null;
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesDiaActual = hoy.getMonth() * 100 + hoy.getDate();
  const mesDiaNacimiento = fecha.getUTCMonth() * 100 + fecha.getUTCDate();
  return anioActual - fecha.getUTCFullYear() - Number(mesDiaActual < mesDiaNacimiento);
}

export function PantallaPerfil() {
  const { sesion } = useSesion();
  const esAdmin = Boolean(sesion?.usuario.roles?.includes('admin'));
  const [perfil, setPerfil] = useState<PerfilFormulario>(PERFIL_VACIO);
  const [perfilGuardado, setPerfilGuardado] = useState<PerfilFormulario>(PERFIL_VACIO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [alta, setAlta] = useState(false);
  const [nacimiento, setNacimiento] = useState('');
  const { width } = useWindowDimensions();
  const anchoContenido = Math.min(width, 460);

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      const local = await leerPerfilLocal();
      if (local?.telefono) local.telefono = normalizarTelefonoGuardado(local.telefono);
      if (!activo) return;

      try {
        const remoto = await obtenerPerfil();
        if (activo) {
          const remotoNormalizado = perfilDesdeApi(remoto);
          remotoNormalizado.telefono = normalizarTelefonoGuardado(remotoNormalizado.telefono ?? '');
          const datos = { ...remotoNormalizado, ...local };
          setPerfil(datos);
          setPerfilGuardado(datos);
        }
      } catch (causa) {
        if (activo) {
          if (local) {
            setPerfil(local);
            setPerfilGuardado(local);
          }
          if (causa instanceof PerfilNoEncontrado) setAlta(true);
          else if (!local) setError(
            'No pudimos cargar tu perfil desde el servidor. Completa tus datos y guárdalos cuando quieras.',
          );
        }
      } finally {
        if (activo) setCargando(false);
      }
    };

    void cargar();
    return () => {
      activo = false;
    };
  }, []);

  const actualizarCampo =
    (campo: keyof PerfilFormulario) => (valor: string) => {
      setPerfil((actual) => ({ ...actual, [campo]: valor }));
      setError(null);
      setAviso(null);
      setExito(null);
    };

  const biografiaExcedida = perfil.biografia.length > MAX_BIOGRAFIA;
  const iniciales =
    perfil.nombre
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]?.toLocaleUpperCase('es') ?? '')
      .join('') || 'RL';

  const guardar = async () => {
    if (guardando || biografiaExcedida) return;

    const edad = alta ? edadDesdeNacimiento(nacimiento) : null;
    if (alta && edad === null) {
      setError('Escribe una fecha de nacimiento válida con el formato AAAA-MM-DD.');
      return;
    }
    const actual = edad === null ? perfil : { ...perfil, edad: String(edad) };
    const errorValidacion = validarPerfil(actual);
    setError(errorValidacion);
    setAviso(null);
    setExito(null);
    if (errorValidacion) return;

    const datos = normalizarPerfil(actual);
    setGuardando(true);

    try {
      await guardarPerfilLocal(datos);
      setPerfilGuardado(datos);
    } catch {
      setError('No pudimos guardar los cambios en este dispositivo.');
      setGuardando(false);
      return;
    }

    try {
      const datosApi = {
        fullName: datos.nombre,
        occupation: datos.ocupacion || null,
        bio: datos.biografia || null,
        ...(datos.telefono !== undefined && { phone: datos.telefono || null }),
      };
      const remoto = alta
        ? await crearPerfil({ ...datosApi, birthDate: nacimiento, instagram: datos.instagram })
        : await actualizarPerfil(datosApi);
      setAlta(false);
      if (!alta && datos.instagram !== undefined && datos.instagram !== (remoto.instagram ?? '')) {
        await actualizarInstagram(datos.instagram);
      }
      const sincronizado: PerfilFormulario = {
        ...datos,
        nombre: remoto.fullName,
        ocupacion: remoto.occupation ?? '',
        biografia: remoto.bio ?? '',
      };
      setPerfil(sincronizado);
      setPerfilGuardado(sincronizado);
      await guardarPerfilLocal(sincronizado).catch(() => undefined);
      setExito('Tu perfil se guardó correctamente.');
    } catch {
      setPerfil(datos);
      setAviso(
        'Tus cambios se guardaron en este dispositivo, pero no se pudieron sincronizar con el servidor.',
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.areaSegura}>
      <ScrollView
        contentContainerStyle={[styles.contenido, { width: anchoContenido }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <MarcaRoomLink />

        <View style={styles.encabezado}>
          <View style={styles.avatar}>
            <Text style={styles.iniciales}>{iniciales}</Text>
          </View>
          <View style={styles.encabezadoTexto}>
            <Text accessibilityRole="header" style={styles.titulo}>Mi perfil</Text>
            <Text style={styles.subtitulo}>Edita tu perfil y tus preferencias de vivienda</Text>
          </View>
        </View>

        {cargando ? (
          <Text style={styles.estado}>Cargando tu perfil…</Text>
        ) : (
          <>
            <View style={styles.tarjeta}>
              <Text style={styles.tituloSeccion}>Datos personales</Text>

              <View style={styles.filaCampos}>
                <View style={styles.columnaPrincipal}>
                  <CampoPerfil
                    accessibilityLabel="Nombre"
                    alCambiar={actualizarCampo('nombre')}
                    etiqueta="Nombre"
                    maxLength={50}
                    placeholder="Tu nombre completo"
                    valor={perfil.nombre}
                  />
                </View>
                {!alta && <View style={styles.columnaEdad}>
                  <CampoPerfil
                    accessibilityLabel="Edad"
                    alCambiar={actualizarCampo('edad')}
                    etiqueta="Edad"
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="24"
                    valor={perfil.edad}
                  />
                </View>}
              </View>

              {alta && <CampoPerfil alCambiar={setNacimiento} etiqueta="Fecha de nacimiento" maxLength={10} placeholder="AAAA-MM-DD" valor={nacimiento} />}

              <CampoPerfil
                accessibilityLabel="Ocupación"
                alCambiar={actualizarCampo('ocupacion')}
                etiqueta="Ocupación"
                maxLength={160}
                placeholder="Estudiante, diseño gráfico"
                valor={perfil.ocupacion}
              />
            </View>

            <Tarjeta titulo="Información visible">
              <CampoPerfil alCambiar={actualizarCampo('ciudad')} etiqueta="Ciudad" ayuda="Se guarda en este dispositivo." maxLength={120} valor={perfil.ciudad ?? ''} />
              <CampoPerfil alCambiar={actualizarCampo('instagram')} autoCapitalize="none" etiqueta="Instagram (opcional)" maxLength={255} placeholder="@usuario" valor={perfil.instagram ?? ''} />
              <Accion alPulsar={() => setVistaPrevia(!vistaPrevia)} texto={vistaPrevia ? 'Ocultar vista previa' : 'Ver vista previa del perfil'} />
              {vistaPrevia && <>
                <Texto>{perfil.nombre || 'Tu nombre'}{perfil.edad ? `, ${perfil.edad} años` : ''}</Texto>
                <Texto secundario>{[perfil.ciudad, perfil.ocupacion, perfil.biografia, perfil.instagram].filter(Boolean).join(' · ')}</Texto>
              </>}
            </Tarjeta>
            <Tarjeta titulo="Datos de contacto">
              <Texto secundario>Correo de tu cuenta</Texto>
              <Texto>{sesion?.usuario.email}</Texto>
              <CampoPerfil
                alCambiar={actualizarCampo('telefono')}
                etiqueta="Teléfono"
                ayuda="10 dígitos de México, sin lada internacional. Opcional."
                keyboardType="phone-pad"
                valor={perfil.telefono ?? ''}
              />
            </Tarjeta>

            <View style={styles.tarjeta}>
              <View style={styles.filaTitulo}>
                <Text style={styles.tituloSeccion}>Sobre ti</Text>
                <Text
                  accessibilityLiveRegion="polite"
                  style={[styles.contador, biografiaExcedida && styles.contadorExcedido]}>
                  {perfil.biografia.length}/{MAX_BIOGRAFIA}
                </Text>
              </View>
              <Text style={styles.ayudaSeccion}>
                Cuéntale a tus futuros roomies cómo es vivir contigo.
              </Text>
              <CampoPerfil
                accessibilityLabel="Biografía"
                alCambiar={actualizarCampo('biografia')}
                ayuda={
                  biografiaExcedida
                    ? `Reduce ${perfil.biografia.length - MAX_BIOGRAFIA} caracteres para poder guardar.`
                    : 'Máximo 300 caracteres.'
                }
                error={
                  biografiaExcedida
                    ? 'La biografía no puede superar los 300 caracteres.'
                    : undefined
                }
                etiqueta="Biografía"
                multiline
                placeholder="Soy tranquilo, ordenado y me gusta cocinar…"
                valor={perfil.biografia}
              />
            </View>

            <View style={styles.tarjeta}>
              <Text style={styles.tituloSeccion}>Preferencias de vivienda</Text>
              <Text style={styles.ayudaSeccion}>
                Nos ayuda a mostrarte espacios y roomies más afines.
              </Text>

              <CampoPerfil
                accessibilityLabel="Zona deseada"
                alCambiar={actualizarCampo('zona')}
                etiqueta="Zona deseada"
                maxLength={160}
                placeholder="Ej. Centro, Chapultepec"
                valor={perfil.zona}
              />

              <View style={styles.filaCampos}>
                <CampoPerfil
                  accessibilityLabel="Presupuesto mínimo"
                  alCambiar={actualizarCampo('presupuestoMin')}
                  etiqueta="Presupuesto mínimo"
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholder="0"
                  prefijo="$"
                  sufijo="MXN"
                  valor={perfil.presupuestoMin}
                />
                <CampoPerfil
                  accessibilityLabel="Presupuesto máximo"
                  alCambiar={actualizarCampo('presupuestoMax')}
                  etiqueta="Presupuesto máximo"
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholder="0"
                  prefijo="$"
                  sufijo="MXN"
                  valor={perfil.presupuestoMax}
                />
              </View>
            </View>

            {error && (
              <View accessibilityRole="alert" style={styles.mensajeError}>
                <Text style={styles.textoError}>{error}</Text>
              </View>
            )}
            {aviso && (
              <View accessibilityRole="alert" style={styles.mensajeAviso}>
                <Text style={styles.textoAviso}>{aviso}</Text>
              </View>
            )}
            {exito && (
              <View accessibilityRole="alert" style={styles.mensajeExito}>
                <Text style={styles.textoExito}>{exito}</Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: guardando || biografiaExcedida }}
              disabled={guardando || biografiaExcedida}
              onPress={guardar}
              style={({ pressed }) => [
                styles.botonGuardar,
                pressed && styles.botonPresionado,
                (guardando || biografiaExcedida) && styles.botonDeshabilitado,
              ]}>
              <Text style={styles.textoBoton}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </Text>
            </Pressable>

            <Accion alPulsar={() => {
              setPerfil(perfilGuardado);
              setNacimiento('');
              setError(null);
              setAviso(null);
              setExito(null);
            }} deshabilitada={guardando || (perfil === perfilGuardado && !nacimiento)} peligro texto="Cancelar cambios" />

            <View style={styles.tarjeta}>
              <Text style={styles.tituloSeccion}>Acciones y cuenta</Text>
              <Link href="/cuenta" asChild>
                <Pressable accessibilityRole="link" style={styles.botonSecundario}>
                  <Text style={styles.textoBotonSecundario}>Cuenta y notificaciones</Text>
                </Pressable>
              </Link>
              <Link href="/notificaciones" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.botonSecundario,
                    pressed && styles.botonPresionado,
                  ]}>
                  <Text style={styles.textoBotonSecundario}>
                    Centro de notificaciones
                  </Text>
                </Pressable>
              </Link>

              <Link href="/conexiones" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.botonSecundario,
                    pressed && styles.botonPresionado,
                  ]}>
                  <Text style={styles.textoBotonSecundario}>
                    Solicitudes de conexión
                  </Text>
                </Pressable>
              </Link>

              <Link href="/acuerdos" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.botonSecundario,
                    pressed && styles.botonPresionado,
                  ]}>
                  <Text style={styles.textoBotonSecundario}>
                    Acuerdos de convivencia
                  </Text>
                </Pressable>
              </Link>

              <Link href="/compatibilidad-detalle" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.botonSecundario,
                    pressed && styles.botonPresionado,
                  ]}>
                  <Text style={styles.textoBotonSecundario}>
                    Compatibilidad y perfiles guardados
                  </Text>
                </Pressable>
              </Link>

              <Link href="/galeria-fotos" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.botonSecundario,
                    pressed && styles.botonPresionado,
                  ]}>
                  <Text style={styles.textoBotonSecundario}>
                    Fotos y verificación
                  </Text>
                </Pressable>
              </Link>

              {esAdmin && (
                <>
                  <Link href="/analytics" asChild>
                    <Pressable
                      accessibilityRole="link"
                      style={({ pressed }) => [
                        styles.botonAdmin,
                        pressed && styles.botonPresionado,
                      ]}>
                      <Text style={styles.textoBotonAdmin}>Dashboard de analítica (Admin)</Text>
                    </Pressable>
                  </Link>
                  <Link href="/moderacion" asChild>
                    <Pressable
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.botonAdmin,
                        pressed && styles.botonPresionado,
                      ]}>
                      <Text style={styles.textoBotonAdmin}>
                        Panel de moderación (Admin)
                      </Text>
                    </Pressable>
                  </Link>
                  <Link href="/sanciones" asChild>
                    <Pressable
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.botonAdmin,
                        pressed && styles.botonPresionado,
                      ]}>
                      <Text style={styles.textoBotonAdmin}>
                        Panel de sanciones (Admin)
                      </Text>
                    </Pressable>
                  </Link>
                </>
              )}

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void cerrarSesion();
                }}
                style={({ pressed }) => [
                  styles.botonCerrarSesion,
                  pressed && styles.botonPresionado,
                ]}>
                <Text style={styles.textoCerrarSesion}>Cerrar sesión</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  areaSegura: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: color.blanco,
  },
  contenido: {
    flexGrow: 1,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 104,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    padding: 17,
    borderRadius: 12,
    backgroundColor: color.superficie,
  },
  avatar: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: color.menta,
  },
  iniciales: {
    color: color.accion,
    fontSize: 15,
    fontWeight: '600',
  },
  encabezadoTexto: {
    flex: 1,
    marginLeft: 11,
  },
  titulo: {
    color: color.tinta,
    fontSize: 29,
    fontWeight: '600',
    letterSpacing: -0.65,
  },
  subtitulo: {
    color: color.secundario,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  estado: {
    color: color.secundario,
    fontSize: 14,
    textAlign: 'center',
    padding: 22,
  },
  tarjeta: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: color.blanco,
    borderWidth: 1,
    borderColor: color.borde,
    marginTop: 12,
  },
  tituloSeccion: {
    color: color.tinta,
    fontSize: 17,
    fontWeight: '600',
  },
  filaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ayudaSeccion: {
    color: color.secundario,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  contador: {
    color: color.secundario,
    fontSize: 10,
    fontWeight: '600',
  },
  contadorExcedido: {
    color: color.rosaTexto,
  },
  filaCampos: {
    flexDirection: 'row',
    gap: 8,
  },
  columnaPrincipal: {
    flex: 1,
    minWidth: 0,
  },
  columnaEdad: {
    flex: 0.36,
    minWidth: 0,
  },
  mensajeError: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: color.rosa,
    marginTop: 12,
  },
  textoError: {
    color: color.rosaTexto,
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
  mensajeAviso: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: color.menta,
    marginTop: 12,
  },
  textoAviso: {
    color: color.accion,
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
  mensajeExito: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: color.menta,
    marginTop: 12,
  },
  textoExito: {
    color: color.accion,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
  },
  botonGuardar: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: color.accion,
    marginTop: 14,
  },
  botonPresionado: {
    opacity: 0.82,
  },
  botonDeshabilitado: {
    opacity: 0.45,
  },
  textoBoton: {
    color: color.blanco,
    fontSize: 14,
    fontWeight: '600',
  },
  botonSecundario: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: color.fondo,
    borderWidth: 1,
    borderColor: color.borde,
    marginTop: 10,
  },
  textoBotonSecundario: {
    color: color.accion,
    fontSize: 14,
    fontWeight: '600',
  },
  botonAdmin: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: color.menta,
    marginTop: 8,
  },
  textoBotonAdmin: {
    color: color.accion,
    fontSize: 14,
    fontWeight: '700',
  },
  botonCerrarSesion: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: color.rosa,
    marginTop: 8,
  },
  textoCerrarSesion: {
    color: color.rosaTexto,
    fontSize: 14,
    fontWeight: '600',
  },
});
