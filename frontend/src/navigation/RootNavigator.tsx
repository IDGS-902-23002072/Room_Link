import React from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { M06Navigator } from '../navigation/M06Navigator';
import { AppTabBar } from '../shared/components/AppTabBar';
import { colors } from '../shared/theme';

const Tab = createBottomTabNavigator();

function Placeholder({ name }: { name: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <Text style={{ color: colors.textMuted }}>{name} (pendiente)</Text>
    </View>
  );
}

export function RootNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* Descubrir hospeda el módulo 06 mientras se integran los demás módulos */}
      <Tab.Screen name="Descubrir" component={M06Navigator} />
      <Tab.Screen name="Anuncios">{() => <Placeholder name="Anuncios" />}</Tab.Screen>
      <Tab.Screen name="Chats">{() => <Placeholder name="Chats" />}</Tab.Screen>
      <Tab.Screen name="Perfil">{() => <Placeholder name="Perfil" />}</Tab.Screen>
    </Tab.Navigator>
  );
}
