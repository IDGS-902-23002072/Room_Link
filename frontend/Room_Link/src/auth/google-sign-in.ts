// Expo web usa el acceso de la aplicación Vite.
export const googleDisponible = false;

export async function entrarConGoogle(_aceptaTerminos: boolean): Promise<void> {
  throw new Error('El acceso con Google no está disponible en esta plataforma.');
}
