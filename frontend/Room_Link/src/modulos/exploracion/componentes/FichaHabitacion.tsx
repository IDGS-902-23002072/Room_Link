import { color } from '@/constants/roomlink';

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  denunciarAnuncio,
  type MotivoDenunciaAnuncio,
} from '@/modulos/moderacion/api';

import type { HabitacionFeed } from '../datos/habitaciones';
import { PortadaHabitacion } from './PortadaHabitacion';

const MOTIVOS_DENUNCIA: { key: MotivoDenunciaAnuncio; label: string }[] = [
  { key: 'fraud', label: 'Fraude' },
  { key: 'spam', label: 'Spam' },
  { key: 'inappropriate', label: 'Inapropiado' },
  { key: 'other', label: 'Otro' },
];

export function FichaHabitacion({
  habitacion,
  postulada,
  bloqueoPostulacion,
  enviando,
  alPostularse,
  alCerrar,
}: {
  habitacion: HabitacionFeed;
  postulada: boolean;
  bloqueoPostulacion?: string | undefined;
  enviando: boolean;
  alPostularse: (mensaje: string | null) => void;
  alCerrar: () => void;
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState('');
  const [mostrandoDenuncia, setMostrandoDenuncia] = useState(false);
  const [motivoDenuncia, setMotivoDenuncia] =
    useState<MotivoDenunciaAnuncio>('fraud');
  const [detalleDenuncia, setDetalleDenuncia] = useState('');
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);
  const [estadoDenuncia, setEstadoDenuncia] = useState<string | null>(null);
  const [errorDenuncia, setErrorDenuncia] = useState<string | null>(null);

  const enviarDenuncia = async () => {
    if (enviandoDenuncia) return;
    setEnviandoDenuncia(true);
    setErrorDenuncia(null);
    setEstadoDenuncia(null);
    try {
      await denunciarAnuncio(habitacion.id, motivoDenuncia, detalleDenuncia);
      setEstadoDenuncia('Denuncia enviada al equipo de moderación.');
      setMostrandoDenuncia(false);
      setDetalleDenuncia('');
    } catch (err) {
      setErrorDenuncia(
        err instanceof Error ? err.message : 'No se pudo enviar la denuncia.',
      );
    } finally {
      setEnviandoDenuncia(false);
    }
  };

  return (
    <View>
      <View style={styles.portada}>
        <PortadaHabitacion id={habitacion.id} fotos={habitacion.fotos} />
        {habitacion.fotos > 0 && <Text style={styles.fotos}>
          {habitacion.fotos} {habitacion.fotos === 1 ? 'foto' : 'fotos'}
        </Text>}
      </View>

      <Text accessibilityRole="header" style={styles.titulo}>{habitacion.titulo}</Text>
      <Text style={styles.renta}>{habitacion.rentaTexto}</Text>
      {habitacion.compatibilidad !== null && (
        <Text style={styles.compatibilidad}>
          {habitacion.compatibilidad}% compatible con el anfitrión
        </Text>
      )}

      <View style={styles.datos}>
        <View style={styles.dato}>
          <Text style={styles.etiqueta}>Disponibilidad</Text>
          <Text style={styles.valor}>
            {habitacion.disponibleYa
              ? 'Disponible ahora'
              : habitacion.disponibleDesde}
          </Text>
        </View>
        <View style={styles.dato}>
          <Text style={styles.etiqueta}>Compañeros</Text>
          <Text style={styles.valor}>
            {habitacion.maxCompaneros
              ? `Hasta ${habitacion.maxCompaneros}`
              : 'No indicado'}
          </Text>
        </View>
      </View>

      <Text style={styles.etiqueta}>Descripción</Text>
      <Text style={styles.descripcion}>
        {habitacion.descripcion ?? 'Esta habitación aún no tiene una descripción.'}
      </Text>

      <View style={styles.datos}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/inmueble-detalle',
              params: { listingId: habitacion.id },
            })
          }
          style={[styles.botonSecundario, { flex: 1, minHeight: 42, paddingHorizontal: 8 }]}
        >
          <Text style={styles.textoBotonSecundario}>Reglas, costos y zona</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/compatibilidad-detalle',
              params: { candidateId: habitacion.hostId },
            })
          }
          style={[styles.botonSecundario, { flex: 1, minHeight: 42, paddingHorizontal: 8 }]}
        >
          <Text style={styles.textoBotonSecundario}>Ver compatibilidad</Text>
        </Pressable>
      </View>

      {!postulada && !bloqueoPostulacion && (
        <>
          <Text style={[styles.etiqueta, styles.etiquetaMensaje]}>
            Mensaje para el anfitrión (opcional)
          </Text>
          <TextInput
            accessibilityLabel="Mensaje para el anfitrión"
            maxLength={500}
            multiline
            onChangeText={setMensaje}
            placeholder="Preséntate brevemente…"
            placeholderTextColor={color.secundario}
            style={styles.mensaje}
            value={mensaje}
          />
        </>
      )}

      <View style={styles.acciones}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: postulada || enviando || Boolean(bloqueoPostulacion) }}
          disabled={postulada || enviando || Boolean(bloqueoPostulacion)}
          onPress={() => alPostularse(mensaje)}
          style={({ pressed }) => [
            styles.botonPrincipal,
            (postulada || enviando || Boolean(bloqueoPostulacion)) && styles.botonDeshabilitado,
            pressed && styles.presionado,
          ]}>
          <Text style={styles.textoBotonPrincipal}>
            {postulada ? 'Postulación enviada' : enviando ? 'Enviando…' : bloqueoPostulacion ?? 'Postularme'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={alCerrar}
          style={styles.botonSecundario}>
          <Text style={styles.textoBotonSecundario}>Volver al feed</Text>
        </Pressable>

        {estadoDenuncia && (
          <View style={styles.avisoExito}>
            <Text style={styles.textoAvisoExito}>{estadoDenuncia}</Text>
          </View>
        )}
        {errorDenuncia && (
          <View style={styles.avisoError}>
            <Text style={styles.textoAvisoError}>{errorDenuncia}</Text>
          </View>
        )}

        {mostrandoDenuncia ? (
          <View style={styles.cajaDenuncia}>
            <Text style={styles.etiqueta}>Reportar publicación</Text>
            <View style={styles.chipsMotivos}>
              {MOTIVOS_DENUNCIA.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => setMotivoDenuncia(m.key)}
                  style={[
                    styles.chipMotivo,
                    motivoDenuncia === m.key && styles.chipMotivoActivo,
                  ]}>
                  <Text
                    style={[
                      styles.textoChipMotivo,
                      motivoDenuncia === m.key && styles.textoChipMotivoActivo,
                    ]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={detalleDenuncia}
              onChangeText={setDetalleDenuncia}
              placeholder="Describe el problema (opcional)"
              placeholderTextColor={color.secundario}
              style={styles.mensaje}
              multiline
            />
            <View style={styles.filaAccionesDenuncia}>
              <Pressable
                accessibilityRole="button"
                disabled={enviandoDenuncia}
                onPress={enviarDenuncia}
                style={styles.botonEnviarDenuncia}>
                <Text style={styles.textoEnviarDenuncia}>
                  {enviandoDenuncia ? 'Enviando…' : 'Enviar reporte'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setMostrandoDenuncia(false)}
                style={styles.botonCancelarDenuncia}>
                <Text style={styles.textoCancelarDenuncia}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="link"
            onPress={() => setMostrandoDenuncia(true)}
            style={styles.enlaceReportar}>
            <Text style={styles.textoEnlaceReportar}>Reportar este anuncio</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  portada: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: color.mentaSuave,
  },
  fotos: {
    position: 'absolute', top: 12, right: 12, padding: 7, borderRadius: 10,
    overflow: 'hidden', backgroundColor: color.blanco,
    color: color.accion,
    fontSize: 12,
    fontWeight: '600',
  },
  titulo: {
    color: color.tinta,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    lineHeight: 28,
  },
  renta: {
    color: color.accion,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  compatibilidad: {
    color: color.accion,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  datos: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  dato: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: color.blanco,
  },
  etiqueta: {
    color: color.secundario,
    fontSize: 12,
    fontWeight: '600',
  },
  valor: {
    color: color.tinta,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  descripcion: {
    color: color.secundario,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
  etiquetaMensaje: {
    marginTop: 16,
  },
  mensaje: {
    minHeight: 84,
    padding: 12,
    marginTop: 5,
    borderWidth: 1,
    borderColor: color.borde,
    borderRadius: 14,
    backgroundColor: color.blanco,
    color: color.tinta,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  acciones: {
    gap: 8,
    marginTop: 14,
  },
  botonPrincipal: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: color.accion,
  },
  botonDeshabilitado: {
    backgroundColor: color.lavanda,
  },
  presionado: {
    opacity: 0.75,
  },
  textoBotonPrincipal: {
    color: color.blanco,
    fontSize: 15,
    fontWeight: '600',
  },
  botonSecundario: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: color.menta,
  },
  textoBotonSecundario: {
    color: color.accion,
    fontSize: 14,
    fontWeight: '600',
  },
  enlaceReportar: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  textoEnlaceReportar: {
    color: color.secundario,
    fontSize: 12,
    fontWeight: '600',
  },
  cajaDenuncia: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: color.blanco,
    borderWidth: 1,
    borderColor: color.borde,
    gap: 8,
    marginTop: 6,
  },
  chipsMotivos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipMotivo: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: color.menta,
  },
  chipMotivoActivo: {
    backgroundColor: color.accion,
  },
  textoChipMotivo: {
    color: color.accion,
    fontSize: 12,
    fontWeight: '600',
  },
  textoChipMotivoActivo: {
    color: color.blanco,
  },
  filaAccionesDenuncia: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  botonEnviarDenuncia: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: color.rosaTexto,
  },
  textoEnviarDenuncia: {
    color: color.blanco,
    fontSize: 13,
    fontWeight: '700',
  },
  botonCancelarDenuncia: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: color.menta,
  },
  textoCancelarDenuncia: {
    color: color.accion,
    fontSize: 13,
    fontWeight: '600',
  },
  avisoExito: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#DCF0E8',
  },
  textoAvisoExito: {
    color: color.accion,
    fontSize: 12,
    fontWeight: '600',
  },
  avisoError: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: color.rosa,
  },
  textoAvisoError: {
    color: color.rosaTexto,
    fontSize: 12,
    fontWeight: '600',
  },
});
