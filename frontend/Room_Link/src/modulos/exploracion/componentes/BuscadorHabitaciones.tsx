import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export const filtrosHabitaciones = [
  'Todas',
  'Disponibles ya',
  'Hasta $3,000',
  'Hasta $5,000',
] as const;

export type FiltroHabitacion = (typeof filtrosHabitaciones)[number];

export function BuscadorHabitaciones({
  busqueda,
  filtroActivo,
  alBuscar,
  alCambiarFiltro,
}: {
  busqueda: string;
  filtroActivo: FiltroHabitacion;
  alBuscar: (valor: string) => void;
  alCambiarFiltro: (filtro: FiltroHabitacion) => void;
}) {
  return (
    <>
      <View style={styles.campoBusqueda}>
        <Text style={styles.iconoBusqueda}>⌕</Text>
        <TextInput
          accessibilityLabel="Buscar habitaciones"
          onChangeText={alBuscar}
          placeholder="Buscar habitaciones"
          placeholderTextColor="#9A909E"
          returnKeyType="search"
          style={styles.entrada}
          value={busqueda}
        />
      </View>
      <View style={styles.filtros}>
        {filtrosHabitaciones.map((filtro) => {
          const activo = filtroActivo === filtro;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              key={filtro}
              onPress={() => alCambiarFiltro(filtro)}
              style={[styles.filtro, activo && styles.filtroActivo]}>
              <Text style={[styles.textoFiltro, activo && styles.textoFiltroActivo]}>
                {filtro}
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
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 9,
  },
  filtro: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE8F0',
  },
  filtroActivo: {
    backgroundColor: '#E9DAEC',
    borderColor: '#E9DAEC',
  },
  textoFiltro: {
    color: '#6F5B76',
    fontSize: 9,
  },
  textoFiltroActivo: {
    color: '#84658D',
    fontWeight: '600',
  },
});
