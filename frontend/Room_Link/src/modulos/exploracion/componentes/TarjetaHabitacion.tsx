import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { color } from '@/constants/roomlink';

import type { HabitacionFeed } from '../datos/habitaciones';
import { PortadaHabitacion } from './PortadaHabitacion';

export function TarjetaHabitacion({
  habitacion, postulada, bloqueoPostulacion, enviando, guardada,
  alAbrir, alAlternarGuardada, alPostularme,
}: {
  habitacion: HabitacionFeed;
  postulada: boolean;
  bloqueoPostulacion?: string;
  enviando: boolean;
  guardada: boolean;
  alAbrir: () => void;
  alAlternarGuardada: () => void;
  alPostularme: () => void;
}) {
  const deshabilitada = enviando || Boolean(bloqueoPostulacion);
  const compartir = () => {
    void Share.share({ message: `${habitacion.titulo} · ${habitacion.rentaTexto}` }).catch(() => undefined);
  };

  return (
    <View testID={`habitacion-${habitacion.id}`} style={styles.tarjeta}>
      <Pressable
        accessibilityLabel={`Abrir habitación ${habitacion.titulo}`}
        accessibilityRole="button"
        onPress={alAbrir}
        style={({ pressed }) => pressed && styles.presionada}>
        <View style={styles.portada}>
          <PortadaHabitacion id={habitacion.id} fotos={habitacion.fotos} />
          <View style={styles.indicadores}>
            <Text style={[styles.disponible, !habitacion.disponibleYa && styles.fecha]}>
              {habitacion.disponibleYa ? 'Disponible ahora' : `Desde ${habitacion.disponibleDesde}`}
            </Text>
            {habitacion.fotos > 0 && (
              <Text style={styles.fotos}>{habitacion.fotos} {habitacion.fotos === 1 ? 'foto' : 'fotos'}</Text>
            )}
          </View>
        </View>
        <View style={styles.cuerpo}>
          <Text style={styles.titulo}>{habitacion.titulo}</Text>
          {habitacion.ubicacion ? <Text style={styles.secundario}>{habitacion.ubicacion}</Text> : null}
          <View style={styles.fila}>
            <Text style={styles.precio}>{habitacion.rentaTexto.replace(' MXN/mes', '')}</Text>
            <Text style={styles.secundario}>MXN / mes</Text>
          </View>
          {habitacion.descripcion && <Text numberOfLines={2} style={styles.secundario}>{habitacion.descripcion}</Text>}
          {(habitacion.anfitrion || habitacion.compatibilidad !== null) && (
            <View style={styles.fila}>
              {habitacion.anfitrion && <Text style={styles.secundario}>Anfitrión · {habitacion.anfitrion}</Text>}
              {habitacion.compatibilidad !== null && (
                <Text style={styles.compatibilidad}>{habitacion.compatibilidad}% compatible</Text>
              )}
            </View>
          )}
        </View>
      </Pressable>
      <View style={styles.acciones}>
        <Pressable
          accessibilityLabel={guardada ? 'Quitar de guardadas' : 'Guardar habitación'}
          accessibilityRole="button"
          accessibilityState={{ selected: guardada }}
          onPress={alAlternarGuardada}
          style={[styles.botonIcono, guardada && styles.guardada]}>
          <Text style={[styles.icono, guardada && styles.textoGuardada]}>{guardada ? '♥' : '♡'}</Text>
        </Pressable>
        <Pressable accessibilityLabel="Compartir habitación" accessibilityRole="button" onPress={compartir} style={styles.botonIcono}>
          <Text style={styles.icono}>↗</Text>
        </Pressable>
        {postulada ? (
          <View style={[styles.boton, styles.enviada]}>
            <Text style={styles.textoEnviada}>✓ Postulación enviada</Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: deshabilitada }}
            disabled={deshabilitada}
            onPress={alPostularme}
            style={({ pressed }) => [styles.boton, styles.primaria, deshabilitada && styles.deshabilitada, pressed && styles.presionada]}>
            <Text style={[styles.textoAccion, deshabilitada && styles.secundario]}>
              {enviando ? 'Enviando…' : bloqueoPostulacion ?? 'Postularme'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderRadius: 24, borderWidth: 1, borderColor: color.borde, overflow: 'hidden', backgroundColor: color.blanco },
  presionada: { opacity: 0.75 },
  portada: { height: 192, backgroundColor: color.mentaSuave, alignItems: 'center', justifyContent: 'center' },
  indicadores: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  disponible: { color: color.accion, backgroundColor: color.menta, fontSize: 12, fontWeight: '800', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, overflow: 'hidden' },
  fecha: { color: color.cremaTexto, backgroundColor: color.crema },
  fotos: { color: color.tinta, backgroundColor: color.blanco, fontSize: 12, fontWeight: '700', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, overflow: 'hidden' },
  cuerpo: { padding: 16, gap: 6 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  titulo: { color: color.tinta, fontSize: 20, lineHeight: 25, fontWeight: '800', letterSpacing: -0.35 },
  precio: { color: color.tinta, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  secundario: { color: color.secundario, fontSize: 13, lineHeight: 19 },
  compatibilidad: { color: color.lavandaTexto, backgroundColor: color.lavanda, fontSize: 12, fontWeight: '700', padding: 7, borderRadius: 10, overflow: 'hidden' },
  acciones: { borderTopWidth: 1, borderColor: color.borde, flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 11 },
  botonIcono: { width: 44, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderColor: color.borde, borderWidth: 1 },
  icono: { color: color.accion, fontSize: 22 },
  guardada: { backgroundColor: color.rosa, borderColor: color.rosa },
  textoGuardada: { color: color.rosaTexto },
  boton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 13 },
  primaria: { backgroundColor: color.accion },
  deshabilitada: { backgroundColor: color.fondo },
  enviada: { backgroundColor: color.menta },
  textoAccion: { color: color.blanco, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  textoEnviada: { color: color.accion, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
