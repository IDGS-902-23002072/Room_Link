import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from './themed-text';

const iconos: Record<string, string> = {
  Descubrir: '⌕',
  Anuncios: '⌂',
  Chats: '○',
  Perfil: '♙',
};

export default function NavegacionPestanas() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <ListaPestanas>
          <TabTrigger name="explorar" href="/explorar" asChild>
            <BotonPestana>Descubrir</BotonPestana>
          </TabTrigger>
          <TabTrigger name="anuncios" href="/anuncios" asChild>
            <BotonPestana>Anuncios</BotonPestana>
          </TabTrigger>
          <TabTrigger name="chats" href="/chats" asChild>
            <BotonPestana>Chats</BotonPestana>
          </TabTrigger>
          <TabTrigger name="perfil" href="/perfil" asChild>
            <BotonPestana>Perfil</BotonPestana>
          </TabTrigger>
        </ListaPestanas>
      </TabList>
    </Tabs>
  );
}

function BotonPestana({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const etiqueta = String(children);
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [
        styles.botonPestana,
        isFocused && styles.pestanaActiva,
        pressed && styles.presionado,
      ]}>
      <Text style={[styles.icono, isFocused && styles.iconoActivo]}>
        {iconos[etiqueta]}
      </Text>
      <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

function ListaPestanas({ children, ...props }: TabListProps) {
  return (
    <View {...props} style={styles.contenedorLista}>
      <View style={styles.lista}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: '100%',
  },
  contenedorLista: {
    position: 'absolute',
    width: '100%',
    bottom: 0,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  lista: {
    width: '100%',
    maxWidth: 460,
    padding: 5,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  botonPestana: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pestanaActiva: {
    backgroundColor: '#E9DAEC',
  },
  icono: {
    color: '#817987',
    fontSize: 15,
    lineHeight: 18,
  },
  iconoActivo: {
    color: '#84658D',
  },
  presionado: {
    opacity: 0.7,
  },
});
