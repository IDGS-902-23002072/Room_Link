import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CompatibilityScreen from '../modules/m06-compatibilidad/screens/CompatibilityScreen';
import SharedPointsScreen from '../modules/m06-compatibilidad/screens/SharedPointsScreen';
import SavedProfilesScreen from '../modules/m06-compatibilidad/screens/SavedProfilesScreen';
import { M06StackParamList } from '../modules/m06-compatibilidad/types';

const Stack = createNativeStackNavigator<M06StackParamList>();

export function M06Navigator() {
  return (
    <Stack.Navigator
      initialRouteName="Compatibility"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Compatibility" component={CompatibilityScreen} />
      <Stack.Screen name="SharedPoints" component={SharedPointsScreen} />
      <Stack.Screen name="SavedProfiles" component={SavedProfilesScreen} />
    </Stack.Navigator>
  );
}
