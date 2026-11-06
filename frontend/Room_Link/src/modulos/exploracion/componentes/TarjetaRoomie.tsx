import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PerfilRoomie } from '../datos/perfilesRoomies';

export function TarjetaRoomie({
  perfil,
  mostrarPreferencias = false,
  alAbrir,
  alVerRapido,
}: {
  perfil: PerfilRoomie;
  mostrarPreferencias?: boolean;
  alAbrir: () => void;
  alVerRapido: () => void;
}) {
  return (
    <View style={styles.tarjeta}>
      <View style={styles.encabezado}>
        <View style={styles.avatar}>
          {perfil.fotoUrl ? (
            <Image source={{ uri: perfil.fotoUrl }} style={styles.foto} />
          ) : (
            <Text style={styles.iniciales}>{perfil.iniciales}</Text>
          )}
        </View>
        <Pressable
          accessibilityLabel={`Vista rápida de ${perfil.nombre}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={(evento) => {
            evento.stopPropagation();
            alVerRapido();
          }}
          style={styles.botonRapido}>
          <Text style={styles.iconoRapido}>◉</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityLabel={`Abrir perfil de ${perfil.nombre}`}
        accessibilityRole="button"
        onPress={alAbrir}
        style={({ pressed }) => [styles.contenido, pressed && styles.presionada]}>
        <Text numberOfLines={1} style={styles.nombre}>
          {perfil.nombre}, {perfil.edad}
        </Text>
        <Text style={styles.compatibilidad}>
          {perfil.compatibilidad === null
            ? 'Afinidad por descubrir'
            : `${perfil.compatibilidad}% compatibles`}
        </Text>
        <Text numberOfLines={1} style={styles.detalle}>
          {perfil.ciudad} · {perfil.zona}
        </Text>
        <Text numberOfLines={1} style={styles.detalle}>
          {mostrarPreferencias ? perfil.presupuesto : perfil.estilo}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    minHeight: 143,
    flexBasis: '47%',
    flexGrow: 1,
    padding: 11,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EBF1',
  },
  contenido: {
    paddingTop: 3,
  },
  presionada: {
    opacity: 0.7,
  },
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#E9DAEC',
  },
  iniciales: {
    color: '#84658D',
    fontSize: 12,
    fontWeight: '600',
  },
  foto: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  botonRapido: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#FBF9FC',
  },
  iconoRapido: {
    color: '#84658D',
    fontSize: 16,
  },
  nombre: {
    color: '#28232D',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  compatibilidad: {
    color: '#84658D',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  detalle: {
    color: '#817987',
    fontSize: 9,
    marginTop: 3,
  },
});
