import { StyleSheet } from 'react-native';

export const estilos = StyleSheet.create({
  progreso: {
    height: 3,
    overflow: 'hidden',
    backgroundColor: '#E9E2EB',
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 14,
  },
  progresoLleno: {
    height: '100%',
    backgroundColor: '#63C8C2',
    borderRadius: 2,
  },
  botonPrincipal: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 11,
    backgroundColor: '#84658D',
    marginTop: 8,
  },
  textoBoton: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  botonPresionado: {
    opacity: 0.82,
  },
  medidor: {
    gap: 5,
  },
  filaMedidor: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  etiquetaMedidor: {
    color: '#28232D',
    fontSize: 11,
  },
  valorMedidor: {
    color: '#28232D',
    fontSize: 10,
    fontWeight: '600',
  },
  fondoMedidor: {
    height: 3,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: '#E9E2EB',
  },
  llenadoMedidor: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#63C8C2',
  },
});
