import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function PantallaPerfil() {
  return (
    <SafeAreaView style={styles.areaSegura}>
      <View style={styles.contenido}>
        <Text style={styles.marca}>ROOMLINK</Text>
        <Text style={styles.titulo}>Tu perfil</Text>
        <Text style={styles.descripcion}>
          Revisa tus preferencias de convivencia y mantén tu perfil al día.
        </Text>
        <Link href="/encuesta" asChild>
          <Pressable style={styles.boton}>
            <Text style={styles.textoBoton}>Editar encuesta de convivencia</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  areaSegura: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FBF9FC',
  },
  contenido: {
    width: '100%',
    maxWidth: 460,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  marca: {
    color: '#817987',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  titulo: {
    color: '#28232D',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  descripcion: {
    color: '#817987',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  boton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#84658D',
    marginTop: 18,
  },
  textoBoton: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
