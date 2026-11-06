import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import {
  MAX_TAMANO_FOTO,
  normalizarTipoFoto,
  type ArchivoSubida,
} from './api';

const LADO_MAXIMO_WEB = 1200;
const CALIDAD_WEB = 0.76;

export interface ResultadoSeleccion {
  archivos: ArchivoSubida[];
  errores: string[];
  cancelado: boolean;
}

export async function seleccionarFotos(
  cantidadDisponible: number,
): Promise<ResultadoSeleccion> {
  if (cantidadDisponible <= 0) {
    return {
      archivos: [],
      errores: ['Máximo 6 fotos.'],
      cancelado: false,
    };
  }

  if (Platform.OS !== 'web') {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      throw new Error(
        'Necesitamos acceso a tu galería para que puedas agregar fotos a tu perfil.',
      );
    }
  }

  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: cantidadDisponible,
    quality: 0.85,
  });

  if (resultado.canceled) {
    return { archivos: [], errores: [], cancelado: true };
  }

  const archivos: ArchivoSubida[] = [];
  const errores: string[] = [];

  for (const asset of resultado.assets) {
    if (archivos.length >= cantidadDisponible) {
      if (!errores.includes('Máximo 6 fotos.')) {
        errores.push('Máximo 6 fotos.');
      }
      break;
    }

    const nombreOriginal =
      asset.fileName?.trim() || `Foto ${archivos.length + 1}`;
    const tipo = normalizarTipoFoto(asset.mimeType, asset.fileName);
    if (!tipo) {
      errores.push(`“${nombreOriginal}” no es JPG, PNG ni WEBP.`);
      continue;
    }

    if (
      typeof asset.fileSize === 'number' &&
      asset.fileSize > MAX_TAMANO_FOTO
    ) {
      errores.push(`“${nombreOriginal}” supera el límite de 5 MB.`);
      continue;
    }

    try {
      const archivo = await prepararArchivo(
        asset,
        tipo,
        nombreOriginal,
        archivos.length,
      );
      if (archivo.file && archivo.file.size > MAX_TAMANO_FOTO) {
        errores.push(`“${nombreOriginal}” supera el límite de 5 MB.`);
        continue;
      }
      archivos.push(archivo);
    } catch {
      errores.push(
        `No pudimos procesar “${nombreOriginal}”. Intenta con otra foto.`,
      );
    }
  }

  return { archivos, errores, cancelado: false };
}

async function prepararArchivo(
  asset: ImagePicker.ImagePickerAsset,
  tipo: string,
  nombre: string,
  indice: number,
): Promise<ArchivoSubida> {
  if (Platform.OS !== 'web') {
    return {
      uri: asset.uri,
      name: nombre,
      type: tipo,
    };
  }

  const original = asset.file ?? (await archivoDesdeUri(asset.uri, nombre, tipo));
  const comprimido = await comprimirImagenWeb(
    original,
    nombre,
    `foto-${indice + 1}`,
  );

  return {
    file: comprimido,
    name: comprimido.name,
    type: comprimido.type || 'image/jpeg',
  };
}

async function archivoDesdeUri(
  uri: string,
  nombre: string,
  tipo: string,
): Promise<File> {
  const respuesta = await fetch(uri);
  if (!respuesta.ok) {
    throw new Error('No se pudo leer la foto seleccionada.');
  }
  const blob = await respuesta.blob();
  return new File([blob], nombre, {
    type: blob.type || tipo,
    lastModified: Date.now(),
  });
}

/**
 * Redimensiona y recomprime la imagen en el navegador antes de subirla, para
 * respetar el límite de 5 MB y acelerar la carga.
 */
async function comprimirImagenWeb(
  archivo: File,
  nombreOriginal: string,
  nombreBase: string,
): Promise<File> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return archivo;
  }

  const objectUrl = URL.createObjectURL(archivo);
  try {
    const imagen = await cargarImagen(objectUrl);
    const ancho = imagen.naturalWidth || imagen.width;
    const alto = imagen.naturalHeight || imagen.height;
    if (!ancho || !alto) return archivo;

    const escala = Math.min(1, LADO_MAXIMO_WEB / Math.max(ancho, alto));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(ancho * escala));
    lienzo.height = Math.max(1, Math.round(alto * escala));

    const contexto = lienzo.getContext('2d');
    if (!contexto) return archivo;

    contexto.fillStyle = '#FFFFFF';
    contexto.fillRect(0, 0, lienzo.width, lienzo.height);
    contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      lienzo.toBlob(resolve, 'image/jpeg', CALIDAD_WEB);
    });
    if (!blob) return archivo;

    return new File(
      [blob],
      cambiarExtension(nombreOriginal || nombreBase, 'jpg'),
      { type: 'image/jpeg', lastModified: Date.now() },
    );
  } catch {
    return archivo;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function cargarImagen(origen: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagen = new window.Image();
    imagen.onload = () => resolve(imagen);
    imagen.onerror = () =>
      reject(new Error('No se pudo leer la foto seleccionada.'));
    imagen.src = origen;
  });
}

function cambiarExtension(nombre: string, extension: string) {
  const base = nombre.replace(/\.[^./\\]+$/, '').trim() || 'foto';
  return `${base}.${extension}`;
}
