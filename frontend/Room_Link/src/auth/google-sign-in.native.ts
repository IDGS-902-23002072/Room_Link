import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { iniciarSesionGoogle } from './api-auth';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
export const googleDisponible = Boolean(webClientId && (Platform.OS === 'android' || (Platform.OS === 'ios' && iosClientId)));

export async function entrarConGoogle(aceptaTerminos: boolean): Promise<void> {
  if (!googleDisponible) return;
  GoogleSignin.configure({ webClientId, ...(iosClientId ? { iosClientId } : {}) });
  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const respuesta = await GoogleSignin.signIn();
  if (!isSuccessResponse(respuesta)) return;
  if (!respuesta.data.idToken) throw new Error('Google no devolvió una credencial válida.');
  await iniciarSesionGoogle(respuesta.data.idToken, aceptaTerminos);
}
