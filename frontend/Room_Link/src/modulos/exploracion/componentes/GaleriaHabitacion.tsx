import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { color } from '@/constants/roomlink';
import { obtenerUrlFoto } from '@/modulos/anuncios/api';
import { Accion, Texto } from '@/modulos/comunes/InterfazModulo';

import type { HabitacionFeed } from '../datos/habitaciones';

function FotoGaleria({ url, etiqueta, width, height }: {
  url: string;
  etiqueta: string;
  width: number;
  height: number;
}) {
  const [fallo, setFallo] = useState(false);
  return (
    <View style={[styles.foto, { width, height }]}>
      {fallo ? <Texto>No se pudo cargar esta foto.</Texto> : (
        <Image
          accessible
          accessibilityLabel={etiqueta}
          contentFit="contain"
          onError={() => setFallo(true)}
          source={url}
          style={styles.imagen}
        />
      )}
    </View>
  );
}

export function GaleriaHabitacion({ habitacion, cargando, alReintentar, alCerrar }: {
  habitacion: HabitacionFeed;
  cargando: boolean;
  alReintentar: () => void;
  alCerrar: () => void;
}) {
  const [{ width, height }, setTamano] = useState({ width: 0, height: 0 });
  const lista = useRef<FlatList<string>>(null);
  const [indice, setIndice] = useState(0);
  const fotos = [...(habitacion.fotosDetalle ?? [])].sort((a, b) => a.position - b.position);
  const ids = fotos.map(({ id }) => id);
  const total = ids.length;
  const pagina = Math.max(0, Math.min(indice, total - 1));

  const irA = (posicion: number) => {
    lista.current?.scrollToOffset({ offset: posicion * width, animated: true });
    setIndice(posicion);
  };

  return (
    <Modal animationType="fade" onRequestClose={alCerrar}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.pantalla}>
          <View style={styles.barra}>
            <Text accessibilityRole="header" style={styles.titulo}>Fotos del anuncio</Text>
            <Accion alPulsar={alCerrar} texto="Cerrar" />
          </View>
          {total > 0 ? (
            <>
              <View
                onLayout={({ nativeEvent: { layout } }) => setTamano({ width: layout.width, height: layout.height })}
                style={styles.visor}
              >
                {width > 0 && height > 0 && (
                  <FlatList
                    key={width}
                    ref={lista}
                    data={ids}
                    getItemLayout={(_, posicion) => ({ length: width, offset: width * posicion, index: posicion })}
                    horizontal
                    initialScrollIndex={pagina}
                    keyExtractor={(id) => id}
                    onMomentumScrollEnd={({ nativeEvent }) => setIndice(Math.round(nativeEvent.contentOffset.x / width))}
                    pagingEnabled
                    renderItem={({ item, index }) => (
                      <FotoGaleria
                        width={width}
                        height={height}
                        etiqueta={`Foto ${index + 1} de ${total}`}
                        url={obtenerUrlFoto(habitacion.id, item)}
                      />
                    )}
                    showsHorizontalScrollIndicator={false}
                  />
                )}
              </View>
              <View style={styles.barra}>
                {total > 1 && <Accion alPulsar={() => irA(pagina - 1)} deshabilitada={pagina === 0} texto="Anterior" />}
                <Text accessibilityLiveRegion="polite" style={styles.contador}>{pagina + 1} de {total}</Text>
                {total > 1 && <Accion alPulsar={() => irA(pagina + 1)} deshabilitada={pagina === total - 1} texto="Siguiente" />}
              </View>
            </>
          ) : (
            <View style={styles.estado}>
              {cargando ? (
                <>
                  <ActivityIndicator color={color.accion} />
                  <Texto>Cargando fotografías…</Texto>
                </>
              ) : habitacion.fotosDetalle ? (
                <Texto>Este anuncio no tiene fotografías disponibles.</Texto>
              ) : (
                <>
                  <Texto>No se pudieron cargar las fotografías.</Texto>
                  <Accion alPulsar={alReintentar} texto="Reintentar" />
                </>
              )}
            </View>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.blanco },
  barra: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  titulo: { flex: 1, color: color.tinta, fontSize: 18, fontWeight: '600' },
  contador: { flex: 1, textAlign: 'center', color: color.tinta },
  visor: { flex: 1, backgroundColor: color.superficie },
  foto: { justifyContent: 'center', alignItems: 'center' },
  imagen: { width: '100%', height: '100%' },
  estado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
});
