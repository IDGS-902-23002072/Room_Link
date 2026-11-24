
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";

import { color } from '@/constants/roomlink';
import { PortadaHabitacion } from '../../exploracion/componentes/PortadaHabitacion';

export type Publicacion = {
  id: string;
  titulo: string;
  precio: string;
  estado:
  | "Activa"
  | "Pausada"
  | "Cerrada"
  | "Borrador";
  detalle?: string;
  fotosCount?: number;
};


type Props = {
  publicacion: Publicacion;
  onEditar?: (id: string) => void;
  onPausar?: (id: string) => void;
  onReactivar?: (id: string) => void;
  onCerrar?: (id: string) => void;
  onVerPostulaciones?: (publicacion: Publicacion) => void;
};

export default function TarjetaPublicacion({
  publicacion,
  onEditar,
  onPausar,
  onReactivar,
  onCerrar,
  onVerPostulaciones,
}: Props) {
  const activa = publicacion.estado === "Activa";
  const cerrada = publicacion.estado === "Cerrada";
  const borrador = publicacion.estado === "Borrador";

  return (
    <View style={styles.tarjeta}>
      <View style={styles.imagen}>
        <PortadaHabitacion id={publicacion.id} fotos={publicacion.fotosCount ?? 0} />
      </View>
      <View style={styles.contenido}>
        <Text style={[styles.estado, activa ? styles.activa : cerrada ? styles.cerrada : borrador ? styles.borrador : styles.pausada]}>
          {publicacion.estado}
        </Text>

        <Text style={styles.titulo}>
          {publicacion.titulo}
        </Text>

        <Text style={styles.detalle}>
          {publicacion.precio} MXN / mes
          {publicacion.detalle ? ` · ${publicacion.detalle}` : ""}
        </Text>

        {!cerrada && (
          <View style={styles.acciones}>
            <Pressable accessibilityRole="button" style={styles.boton} onPress={() => onEditar?.(publicacion.id)}>
              <Text style={styles.accion}>Editar</Text>
            </Pressable>

            {!borrador && (
              <>
                {activa ? (
                  <Pressable accessibilityRole="button" style={styles.boton} onPress={() => onPausar?.(publicacion.id)}>
                    <Text style={styles.accion}>Pausar</Text>
                  </Pressable>
                ) : (
                  <Pressable accessibilityRole="button" style={styles.boton} onPress={() => onReactivar?.(publicacion.id)}>
                    <Text style={styles.accion}>Reactivar</Text>
                  </Pressable>
                )}

                <Pressable accessibilityRole="button" style={[styles.boton, styles.cerrada]} onPress={() => onCerrar?.(publicacion.id)}>
                  <Text style={styles.accionCerrar}>Cerrar</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {!borrador && onVerPostulaciones ? (
          <Pressable
            accessibilityRole="button"
            style={styles.postulaciones}
            onPress={() => onVerPostulaciones(publicacion)}
          >
            <Text style={styles.postulacionesTexto}>Ver postulaciones ›</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: color.blanco, borderRadius: 22, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: color.borde },
  imagen: { height: 142, backgroundColor: color.mentaSuave, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  contenido: { padding: 16, gap: 7 },
  estado: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '800', paddingVertical: 5, paddingHorizontal: 9, borderRadius: 9, overflow: 'hidden' },
  activa: { color: color.accion, backgroundColor: color.menta },
  pausada: { color: color.cremaTexto, backgroundColor: color.crema },
  cerrada: { color: color.rosaTexto, backgroundColor: color.rosa },
  borrador: { color: color.lavandaTexto, backgroundColor: color.lavanda },
  titulo: { color: color.tinta, fontWeight: '800', fontSize: 20, letterSpacing: -0.35 },
  detalle: { color: color.secundario, fontSize: 14 },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  boton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12, backgroundColor: color.mentaSuave },
  accion: { color: color.accion, fontSize: 13, fontWeight: '700' },
  accionCerrar: { color: color.rosaTexto, fontSize: 13, fontWeight: '700' },
  postulaciones: { minHeight: 44, justifyContent: 'center', marginTop: 4, borderTopWidth: 1, borderTopColor: color.borde },
  postulacionesTexto: { color: color.accion, fontSize: 14, fontWeight: '700' },
});
