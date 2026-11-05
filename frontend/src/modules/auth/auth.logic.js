export function validateRegistration({ email, password, termsAccepted }) {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Ingresa un correo válido.";
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!termsAccepted) return "Debes aceptar los términos y condiciones.";
  return null;
}
export function validateLogin({ email, password }) { return !email.trim() || !password ? "Correo y contraseña son obligatorios." : null; }
export function validateReset({ token, password }) { return !token.trim() ? "El token es obligatorio." : password.length < 8 ? "La contraseña debe tener al menos 8 caracteres." : null; }
