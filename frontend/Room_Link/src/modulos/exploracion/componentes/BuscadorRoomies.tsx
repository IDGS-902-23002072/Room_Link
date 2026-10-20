import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const pestanas = ['Perfil', 'Habitaciones', 'Filtros'] as const;

export type PestanaExploracion = (typeof pestanas)[number];

export function BuscadorRoomies({
  busqueda,
  pestanaActiva,
  alBuscar,
  alCambiarPestana,
}: {
  busqueda: string;
  pestanaActiva: PestanaExploracion;
  alBuscar: (valor: string) => void;
  alCambiarPestana: (pestana: PestanaExploracion) => void;
}) {
  return (
    <>
      <View style={styles.campoBusqueda}>
        <Text style={styles.iconoBusqueda}>⌕</Text>
        <TextInput
          accessibilityLabel="Buscar roomies o zona"
          onChangeText={alBuscar}
          placeholder="Buscar roomies o zona"
          placeholderTextColor="#9A909E"
          returnKeyType="search"
          style={styles.entrada}
          value={busqueda}
        />
      </View>
      <View style={styles.pestanas}>
        {pestanas.map((pestana) => {
          const activa = pestanaActiva === pestana;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              key={pestana}
              onPress={() => alCambiarPestana(pestana)}
              style={[styles.pestana, activa && styles.pestanaActiva]}>
              <Text style={[styles.textoPestana, activa && styles.textoPestanaActivo]}>
                {pestana}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  campoBusqueda: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#EEE8F0',
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    marginTop: 16,
  },
  iconoBusqueda: {
    color: '#9C80A4',
    fontSize: 23,
    lineHeight: 25,
    marginRight: 8,
  },
  entrada: {
    flex: 1,
    color: '#28232D',
    fontSize: 12,
    paddingVertical: 0,
  },
  pestanas: {
    minHeight: 27,
    flexDirection: 'row',
    padding: 2,
    borderRadius: 16,
    backgroundColor: '#E9DAEC',
    marginTop: 7,
  },
  pestana: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  pestanaActiva: {
    backgroundColor: '#84658D',
  },
  textoPestana: {
    color: '#6F5B76',
    fontSize: 10,
  },
  textoPestanaActivo: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
