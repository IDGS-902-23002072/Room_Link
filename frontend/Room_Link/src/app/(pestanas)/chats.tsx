
import { useLocalSearchParams } from 'expo-router';
import { PantallaChats } from '@/modulos/chats/PantallaChats';

export default function RutaChats() {
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();

  return <PantallaChats roomIdInicial={roomId} />;
}
