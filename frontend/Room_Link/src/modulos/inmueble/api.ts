import AsyncStorage from '@react-native-async-storage/async-storage';

import { solicitud } from '@/modulos/compatibilidad/api';

export interface DetalleInmuebleBackend {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  monthlyRent: number;
  status: string;
  photosCount: number;
  availableFrom: string | null;
  maxRoommates: number | null;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  } | null;
  photos: {
    id: string;
    fileName: string;
    position: number;
  }[];
}

export interface ConfiguracionM08 {
  reglas: {
    visitas: string;
    ruido: string;
    mascotas: string;
    tabaco: string;
  };
  reglasAdicionales: string;
  deposito: string;
  serviciosIncluidos: string;
  lugaresCercanos: string;
}

export const CONFIG_M08_DEFAULT: ConfiguracionM08 = {
  reglas: {
    visitas: 'con-aviso',
    ruido: '23h',
    mascotas: 'consultar',
    tabaco: 'no',
  },
  reglasAdicionales: 'Mantener áreas comunes ordenadas después de usarlas.',
  deposito: '',
  serviciosIncluidos: 'Agua e internet incluidos (confirmar con anfitrión).',
  lugaresCercanos: '',
};

export function obtenerDetalleInmueble(listingId: string) {
  return solicitud<DetalleInmuebleBackend>(
    `/api/v1/rooms/${encodeURIComponent(listingId)}`,
  );
}

const claveM08 = (listingId: string) => `@roomlink/m08-inmueble:${listingId}`;

export async function cargarConfiguracionM08(
  listingId: string,
): Promise<ConfiguracionM08> {
  try {
    const raw = await AsyncStorage.getItem(claveM08(listingId));
    if (!raw) return CONFIG_M08_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<ConfiguracionM08>;
    return {
      ...CONFIG_M08_DEFAULT,
      ...parsed,
      reglas: {
        ...CONFIG_M08_DEFAULT.reglas,
        ...(parsed.reglas ?? {}),
      },
    };
  } catch {
    return CONFIG_M08_DEFAULT;
  }
}

export async function guardarConfiguracionM08(
  listingId: string,
  config: ConfiguracionM08,
): Promise<void> {
  await AsyncStorage.setItem(claveM08(listingId), JSON.stringify(config));
}
