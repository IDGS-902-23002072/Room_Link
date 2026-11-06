import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function PantallaEnPreparacion({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion: string;
}) {
  return (
    <SafeAreaView style={styles.areaSegura}>
      <View style={styles.contenido}>
        <Text style={styles.marca}>ROOMLINK</Text>
        <View style={styles.icono}>
          <Text style={styles.iconoTexto}>⌂</Text>
        </View>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.descripcion}>{descripcion}</Text>
        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>Este módulo estará disponible próximamente.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  areaSegura: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF9FC',
  },
  contenido: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  marca: {
    color: '#817987',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  icono: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    backgroundColor: '#E9DAEC',
    marginTop: 22,
  },
  iconoTexto: {
    color: '#84658D',
    fontSize: 28,
  },
  titulo: {
    color: '#28232D',
    fontSize: 23,
    fontWeight: '700',
    marginTop: 14,
  },
  descripcion: {
    color: '#817987',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  aviso: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#9BDFDA',
    marginTop: 20,
  },
  avisoTexto: {
    color: '#34474A',
    fontSize: 11,
    textAlign: 'center',
  },
});
