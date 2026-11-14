import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { rangosRenta, type RangoRenta } from '../formato';

export function BuscadorHabitaciones({
  busqueda,
  rangoActivo,
  alBuscar,
  alElegirRango,
}: {
  busqueda: string;
  rangoActivo: RangoRenta;
  alBuscar: (valor: string) => void;
  alElegirRango: (rango: RangoRenta) => void;
}) {
  return (
    <>
      <View style={styles.campoBusqueda}>
        <Text style={styles.iconoBusqueda}>⌕</Text>
        <TextInput
          accessibilityLabel="Buscar habitación, colonia o dirección"
          onChangeText={alBuscar}
          placeholder="Buscar por colonia, calle o título"
          placeholderTextColor="#9A909E"
          returnKeyType="search"
          style={styles.entrada}
          value={busqueda}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.rangos}
        horizontal
        showsHorizontalScrollIndicator={false}>
        {rangosRenta.map((rango) => {
          const activo = rango.nombre === rangoActivo.nombre;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              key={rango.nombre}
              onPress={() => alElegirRango(rango)}
              style={[styles.rango, activo && styles.rangoActivo]}>
              <Text style={[styles.textoRango, activo && styles.textoRangoActivo]}>
                {rango.nombre}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
  rangos: {
    gap: 6,
    paddingVertical: 10,
  },
  rango: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE8F0',
  },
  rangoActivo: {
    backgroundColor: '#E9DAEC',
    borderColor: '#E9DAEC',
  },
  textoRango: {
    color: '#6F5B76',
    fontSize: 10,
  },
  textoRangoActivo: {
    color: '#84658D',
    fontWeight: '600',
  },
});
