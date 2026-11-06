export interface StoredPhotoFile {
  url: string;
  sizeBytes: number;
  mimeType: string;
}

export interface IProfilePhotoStorage {
  /**
   * Guarda el archivo y devuelve la URL pública relativa (por ejemplo
   * `/uploads/photos/<id>.jpg`) junto con su tamaño real.
   */
  save(archivo: File): Promise<StoredPhotoFile>;
  remove(url: string): Promise<void>;
}
