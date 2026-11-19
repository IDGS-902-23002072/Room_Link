export interface OpcionRegla {
  id: string;
  label: string;
}

export interface GrupoRegla {
  id: 'visitas' | 'areasComunes' | 'mascotas';
  titulo: string;
  opciones: OpcionRegla[];
  seleccionInicial: string;
}

export interface LugarCercano {
  id: string;
  nombre: string;
  detalle: string;
}

export interface ConceptoCosto {
  id: string;
  etiqueta: string;
  valor: string;
  /** Si es true, el valor se muestra en grande (como en el mockup) */
  destacado?: boolean;
}

export type M08StackParamList = {
  ReglasCasa: undefined;
  ConoceZona: undefined;
  CostosClaros: undefined;
};