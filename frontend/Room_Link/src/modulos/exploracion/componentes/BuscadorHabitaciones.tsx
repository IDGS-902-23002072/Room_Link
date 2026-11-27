import { useState } from 'react';

import { color } from '@/constants/roomlink';

import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
  const [enfocado, setEnfocado] = useState(false);
  return (
    <>
      <View style={[styles.campoBusqueda, enfocado && styles.enfocado]}>
        <Text accessible={false} style={styles.iconoBusqueda}>⌕</Text>
        <TextInput
          accessibilityLabel="Buscar habitaciones"
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
          onChangeText={alBuscar}
          placeholder="Ciudad, zona o habitación"
          placeholderTextColor={color.secundario}
          returnKeyType="search"
          style={styles.entrada}
          value={busqueda}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.filtros}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        style={styles.filtrosContenedor}>
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
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  enfocado: { borderColor: color.accion },
  campoBusqueda: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: color.borde,
    borderRadius: 8,
    backgroundColor: color.blanco,
  },
  iconoBusqueda: {
    color: color.accion,
    fontSize: 26,
    lineHeight: 28,
    marginRight: 10,
  },
  entrada: {
    flex: 1,
    color: color.tinta,
    fontSize: 15,
    paddingVertical: 0,
  },
  filtrosContenedor: {
    flexGrow: 0,
  },
  filtros: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  filtro: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: color.blanco,
    borderWidth: 1,
    borderColor: color.borde,
    minHeight: 44,
    justifyContent: 'center',
  },
  filtroActivo: {
    backgroundColor: color.tinta,
    borderColor: color.tinta,
  },
  textoFiltro: {
    color: color.secundario,
    fontSize: 14,
  },
  textoFiltroActivo: {
    color: color.blanco,
    fontWeight: '700',
  },
});
