import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  obtenerDetalleHabitacion,
  postularseAHabitacion,
  urlFotoHabitacion,
  type DetalleHabitacion as Detalle,
  type HabitacionFeed,
} from '../../habitaciones/api';
import { formatearFecha, formatearRenta, ubicacionCorta } from '../formato';
import { FotoHabitacion } from './FotoHabitacion';

const LIMITE_MENSAJE = 500;

export function DetalleHabitacion({
  habitacion,
  yaPostulada,
  alPostularse,
}: {
  habitacion: HabitacionFeed;
  yaPostulada: boolean;
  alPostularse: () => void;
}) {
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [fotoActiva, setFotoActiva] = useState(0);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    obtenerDetalleHabitacion(habitacion.id)
      .then((resultado) => {
        if (activo) setDetalle(resultado);
      })
      .catch(() => {
        // Si falla el detalle se sigue mostrando lo que trae el feed.
      });
    return () => {
      activo = false;
    };
  }, [habitacion.id]);

  const fotos = detalle?.photos ?? [];
  const uriFoto =
    fotos[fotoActiva] !== undefined
      ? urlFotoHabitacion(habitacion.id, fotos[fotoActiva].id)
      : habitacion.photosCount > 0
        ? urlFotoHabitacion(habitacion.id, 'first')
        : null;
  const descripcion = detalle?.description ?? habitacion.description;
  const direccion = detalle?.location?.address ?? habitacion.address;

  const postularse = async () => {
    if (enviando || yaPostulada) return;
    setEnviando(true);
    setError(null);
    try {
      await postularseAHabitacion(habitacion.id, mensaje);
      alPostularse();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar tu postulación.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View>
      <FotoHabitacion estilo={styles.fotoPrincipal} key={uriFoto ?? 'sin-foto'} uri={uriFoto} />
      {fotos.length > 1 && (
        <ScrollView
          contentContainerStyle={styles.miniaturas}
          horizontal
          showsHorizontalScrollIndicator={false}>
          {fotos.map((foto, indice) => (
            <Pressable
              accessibilityLabel={`Ver foto ${indice + 1}`}
              accessibilityRole="button"
              key={foto.id}
              onPress={() => setFotoActiva(indice)}
              style={[styles.miniatura, indice === fotoActiva && styles.miniaturaActiva]}>
              <FotoHabitacion
                estilo={styles.imagenMiniatura}
                uri={urlFotoHabitacion(habitacion.id, foto.id)}
              />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.filaPrecio}>
        <Text style={styles.renta}>{formatearRenta(habitacion.monthlyRent)}</Text>
        <Text style={styles.mes}>/ mes</Text>
      </View>
      <Text style={styles.titulo}>{habitacion.title}</Text>
      <Text style={styles.ubicacion}>
        ⌖ {direccion ?? ubicacionCorta(null, habitacion.zone, habitacion.city)}
      </Text>

      <View style={styles.datos}>
        <Dato etiqueta="Disponible" valor={formatearFecha(habitacion.availableFrom)} />
        <Dato
          etiqueta="Compañeros"
          valor={habitacion.maxRoommates ? `Hasta ${habitacion.maxRoommates}` : 'Sin dato'}
        />
        <Dato etiqueta="Anfitrión" valor={habitacion.hostName ?? 'Anfitrión'} />
      </View>

      <Text style={styles.seccion}>Descripción</Text>
      <Text style={styles.descripcion}>
        {descripcion?.trim() || 'El anfitrión aún no agregó una descripción.'}
      </Text>

      {yaPostulada ? (
        <View style={styles.exito} accessibilityRole="alert">
          <Text style={styles.textoExito}>
            ✓ Postulación enviada. El anfitrión revisará tu solicitud.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.seccion}>Mensaje para el anfitrión (opcional)</Text>
          <TextInput
            accessibilityLabel="Mensaje para el anfitrión"
            maxLength={LIMITE_MENSAJE}
            multiline
            onChangeText={setMensaje}
            placeholder="Cuéntale quién eres y por qué te interesa."
            placeholderTextColor="#9A909E"
            style={styles.mensaje}
            value={mensaje}
          />
          <Text style={styles.contador}>
            {mensaje.length}/{LIMITE_MENSAJE}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={enviando}
            onPress={postularse}
            style={({ pressed }) => [styles.boton, (pressed || enviando) && styles.botonPresionado]}>
            {enviando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBoton}>Postularme</Text>
            )}
          </Pressable>
        </>
      )}
      {error && (
        <View accessibilityRole="alert" style={styles.error}>
          <Text style={styles.textoError}>{error}</Text>
        </View>
      )}
    </View>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.etiquetaDato}>{etiqueta}</Text>
      <Text numberOfLines={2} style={styles.valorDato}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fotoPrincipal: {
    width: '100%',
    height: 210,
    borderRadius: 14,
    overflow: 'hidden',
  },
  miniaturas: {
    gap: 6,
    paddingTop: 8,
  },
  miniatura: {
    width: 54,
    height: 42,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  miniaturaActiva: {
    borderColor: '#84658D',
  },
  imagenMiniatura: {
    width: '100%',
    height: '100%',
  },
  filaPrecio: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 14,
  },
  renta: {
    color: '#28232D',
    fontSize: 22,
    fontWeight: '700',
  },
  mes: {
    color: '#817987',
    fontSize: 11,
  },
  titulo: {
    color: '#28232D',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  ubicacion: {
    color: '#817987',
    fontSize: 11,
    marginTop: 4,
  },
  datos: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  dato: {
    flex: 1,
    padding: 10,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EBF1',
  },
  etiquetaDato: {
    color: '#817987',
    fontSize: 9,
  },
  valorDato: {
    color: '#28232D',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  seccion: {
    color: '#28232D',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 16,
  },
  descripcion: {
    color: '#5B5260',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  mensaje: {
    minHeight: 84,
    padding: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#EEE8F0',
    backgroundColor: '#FFFFFF',
    color: '#28232D',
    fontSize: 11,
    textAlignVertical: 'top',
    marginTop: 6,
  },
  contador: {
    alignSelf: 'flex-end',
    color: '#9A909E',
    fontSize: 9,
    marginTop: 3,
  },
  boton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#84658D',
    marginTop: 10,
  },
  botonPresionado: {
    opacity: 0.75,
  },
  textoBoton: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  exito: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#DDF3F1',
    marginTop: 16,
  },
  textoExito: {
    color: '#2E5A57',
    fontSize: 11,
  },
  error: {
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#FCE8E8',
    marginTop: 10,
  },
  textoError: {
    color: '#8A3030',
    fontSize: 11,
  },
});
