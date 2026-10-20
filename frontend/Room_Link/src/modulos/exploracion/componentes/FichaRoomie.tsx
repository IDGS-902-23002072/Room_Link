import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PestanaExploracion } from './BuscadorRoomies';
import type { PerfilRoomie } from '../datos/perfilesRoomies';

export function FichaRoomie({
  perfil,
  pestanaActiva,
  vistaRapida,
  solicitudEnviada,
  comparando,
  alCambiarPestana,
  alAbrirVistaRapida,
  alEnviarSolicitud,
  alComparar,
  alVerPerfilCompleto,
  alCerrar,
}: {
  perfil: PerfilRoomie;
  pestanaActiva: PestanaExploracion;
  vistaRapida: boolean;
  solicitudEnviada: boolean;
  comparando: boolean;
  alCambiarPestana: (pestana: PestanaExploracion) => void;
  alAbrirVistaRapida: () => void;
  alEnviarSolicitud: () => void;
  alComparar: () => void;
  alVerPerfilCompleto: () => void;
  alCerrar: () => void;
}) {
  return (
    <View>
      {vistaRapida && (
        <View style={styles.cinta}>
          <Text style={styles.cintaTexto}>VISTA RÁPIDA</Text>
          <Text style={styles.recomendacion}>PERFIL RECOMENDADO</Text>
        </View>
      )}
      <View style={styles.encabezadoPerfil}>
        <View style={styles.avatar}>
          <Text style={styles.iniciales}>{perfil.iniciales}</Text>
        </View>
        <View style={styles.infoEncabezado}>
          <Text style={styles.nombre}>{perfil.nombre}, {perfil.edad}</Text>
          <Text style={styles.ciudad}>{perfil.ciudad} · {perfil.zona}</Text>
          <Text style={styles.coincidencia}>
            {perfil.compatibilidad}% compatibles · Identidad verificada
          </Text>
        </View>
      </View>

      {!vistaRapida && (
        <View style={styles.pestanas}>
          {(['Perfil', 'Habitaciones', 'Filtros'] as const).map((pestana) => {
            const activa = pestanaActiva === pestana;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: activa }}
                key={pestana}
                onPress={() => alCambiarPestana(pestana)}
                style={[styles.pestana, activa && styles.pestanaActiva]}>
                <Text style={[styles.textoPestana, activa && styles.textoActivo]}>
                  {pestana}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {(vistaRapida || pestanaActiva === 'Perfil') && (
        <>
          <View style={styles.bloque}>
            <Text style={styles.tituloBloque}>Sobre {perfil.nombre.split(' ')[0]}</Text>
            <Text style={styles.cuerpo}>{perfil.bio}</Text>
          </View>
          <View style={styles.bloque}>
            <Text style={styles.tituloBloque}>Mi día a día</Text>
            <Text style={styles.cuerpo}>{perfil.ocupacion}</Text>
          </View>
          <View style={styles.bloque}>
            <Text style={styles.tituloBloque}>Para compartir</Text>
            <Text style={styles.cuerpo}>{perfil.preferencias.join(' · ')}</Text>
          </View>
          <View style={styles.bloque}>
            <Text style={styles.tituloBloque}>Presupuesto mensual</Text>
            <Text style={styles.cuerpo}>{perfil.presupuesto} · {perfil.ciudad}</Text>
          </View>
        </>
      )}

      {!vistaRapida && pestanaActiva === 'Habitaciones' && (
        <View style={styles.bloque}>
          <Text style={styles.tituloBloque}>Habitación disponible</Text>
          <Text style={styles.cuerpo}>{perfil.habitacion}</Text>
          <Text style={styles.cuerpo}>{perfil.presupuesto} al mes</Text>
          <Text style={styles.cuerpo}>Zona {perfil.zona}, {perfil.ciudad}</Text>
        </View>
      )}

      {!vistaRapida && pestanaActiva === 'Filtros' && (
        <View style={styles.bloque}>
          <Text style={styles.tituloBloque}>Preferencias de convivencia</Text>
          <View style={styles.etiquetas}>
            {perfil.preferencias.map((preferencia) => (
              <Text key={preferencia} style={styles.etiqueta}>{preferencia}</Text>
            ))}
          </View>
          <Text style={styles.cuerpo}>Estilo: {perfil.estilo}</Text>
        </View>
      )}

      {comparando && (
        <View accessibilityRole="summary" style={styles.comparacion}>
          <Text style={styles.tituloBloque}>Compatibilidad contigo</Text>
          <Text style={styles.cuerpo}>
            Coinciden en limpieza, horarios y preferencias para compartir.
          </Text>
          <Text style={styles.coincidencia}>{perfil.compatibilidad}% de compatibilidad</Text>
        </View>
      )}

      {solicitudEnviada && (
        <View accessibilityRole="alert" style={styles.confirmacion}>
          <Text style={styles.confirmacionTexto}>
            Solicitud enviada a {perfil.nombre.split(' ')[0]}.
          </Text>
        </View>
      )}

      {vistaRapida ? (
        <>
          <BotonFicha etiqueta="Ver perfil completo" alPresionar={alVerPerfilCompleto} />
          <BotonFicha etiqueta="Cerrar vista rápida" secundario alPresionar={alCerrar} />
        </>
      ) : (
        <>
          <BotonFicha
            etiqueta={solicitudEnviada ? 'Solicitud enviada' : 'Enviar solicitud'}
            alPresionar={alEnviarSolicitud}
          />
          <BotonFicha
            etiqueta={comparando ? 'Ocultar comparación' : 'Comparar compatibilidad'}
            secundario
            alPresionar={alComparar}
          />
          <Pressable
            accessibilityRole="button"
            onPress={alAbrirVistaRapida}
            style={styles.botonTexto}>
            <Text style={styles.botonTextoLabel}>Vista rápida</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function BotonFicha({
  etiqueta,
  alPresionar,
  secundario = false,
}: {
  etiqueta: string;
  alPresionar: () => void;
  secundario?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={alPresionar}
      style={({ pressed }) => [
        styles.boton,
        secundario && styles.botonSecundario,
        pressed && styles.presionado,
      ]}>
      <Text style={[styles.textoBoton, secundario && styles.textoBotonSecundario]}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cinta: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 15,
    backgroundColor: '#E9DAEC',
    marginBottom: 10,
  },
  cintaTexto: {
    color: '#84658D',
    fontSize: 9,
    fontWeight: '700',
  },
  recomendacion: {
    color: '#84658D',
    fontSize: 8,
    fontWeight: '600',
    marginTop: 8,
  },
  encabezadoPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  avatar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#E9DAEC',
  },
  iniciales: {
    color: '#84658D',
    fontSize: 15,
    fontWeight: '600',
  },
  infoEncabezado: {
    flex: 1,
    marginLeft: 10,
  },
  nombre: {
    color: '#28232D',
    fontSize: 13,
    fontWeight: '700',
  },
  ciudad: {
    color: '#817987',
    fontSize: 10,
    marginTop: 2,
  },
  coincidencia: {
    color: '#84658D',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 4,
  },
  pestanas: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 14,
    backgroundColor: '#E9DAEC',
    marginBottom: 10,
  },
  pestana: {
    flex: 1,
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  pestanaActiva: {
    backgroundColor: '#84658D',
  },
  textoPestana: {
    color: '#6F5B76',
    fontSize: 9,
  },
  textoActivo: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bloque: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  tituloBloque: {
    color: '#28232D',
    fontSize: 11,
    fontWeight: '600',
  },
  cuerpo: {
    color: '#817987',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 3,
  },
  etiqueta: {
    color: '#84658D',
    fontSize: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#E9DAEC',
  },
  comparacion: {
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#9BDFDA',
    marginBottom: 8,
  },
  confirmacion: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#E9DAEC',
    marginBottom: 8,
  },
  confirmacionTexto: {
    color: '#84658D',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  boton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#84658D',
    marginTop: 7,
  },
  botonSecundario: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE8F0',
  },
  presionado: {
    opacity: 0.78,
  },
  textoBoton: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  textoBotonSecundario: {
    color: '#84658D',
  },
  botonTexto: {
    alignItems: 'center',
    padding: 9,
  },
  botonTextoLabel: {
    color: '#84658D',
    fontSize: 10,
    fontWeight: '600',
  },
});
