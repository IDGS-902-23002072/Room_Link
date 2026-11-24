import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { color } from '@/constants/roomlink';

export default function NavegacionPestanas() {
  return (
    <NativeTabs
      backgroundColor={color.blanco}
      indicatorColor={color.menta}
      labelStyle={{ default: { color: color.secundario }, selected: { color: color.accion } }}
      iconColor={{ default: color.secundario, selected: color.accion }}
    >
      <NativeTabs.Trigger name="explorar">
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/compass.png')} renderingMode="template" />
        <NativeTabs.Trigger.Label>Descubrir</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="anuncios">
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/home-outline.png')} renderingMode="template" />
        <NativeTabs.Trigger.Label>Anuncios</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chats">
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/chat.png')} renderingMode="template" />
        <NativeTabs.Trigger.Label>Chats</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/profile.png')} renderingMode="template" />
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
