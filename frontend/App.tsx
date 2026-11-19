import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { M08Navigator } from './src/modules/m08-reglas-inmueble';

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <M08Navigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}