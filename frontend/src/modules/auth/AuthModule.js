import { useState } from "react";
import { View } from "react-native";
import { apiRequest, readableError } from "../../api/client";
import {
  Button,
  Checkbox,
  FooterNote,
  GoogleButton,
  HeroCard,
  Label,
  LinkText,
  Logo,
  Notice,
  Screen,
  ScreenHeader,
  TextField,
} from "../../shared/ui";
import { validateLogin, validateRegistration, validateReset } from "./auth.logic";

const titles = {
  login: { eyebrow: "Bienvenido a RoomLink", title: "Inicia sesión", subtitle: "Qué gusto tenerte de vuelta." },
  register: { eyebrow: "Bienvenido a RoomLink", title: "Crea tu cuenta", subtitle: "Da el primer paso hacia tu próximo hogar." },
  recovery: { eyebrow: "Bienvenido a RoomLink", title: "Recupera tu acceso", subtitle: "Te ayudamos a volver a RoomLink." },
};

export function AuthModule({ session, onSession }) {
  const [screen, setScreen] = useState("login");
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirm: "", token: "", termsAccepted: false });
  const [state, setState] = useState({ loading: false, error: "", message: "" });

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const go = (next) => {
    setScreen(next);
    setState({ loading: false, error: "", message: "" });
  };
  const fail = (error) => setState({ loading: false, error, message: "" });
  const run = async (operation) => {
    setState({ loading: true, error: "", message: "" });
    try {
      const message = await operation();
      setState({ loading: false, error: "", message: message ?? "Operación completada." });
    } catch (error) {
      setState({ loading: false, error: readableError(error), message: "" });
    }
  };

  const login = () => {
    const error = validateLogin(form);
    if (error) return fail(error);
    return run(async () => {
      const result = await apiRequest("/auth/login", { method: "POST", body: { email: form.email, password: form.password } });
      onSession({ token: result.token, user: result.user });
      return result.message;
    });
  };
  const register = () => {
    const error = validateRegistration(form);
    if (error) return fail(error);
    return run(async () => (await apiRequest("/auth/register", { method: "POST", body: { email: form.email, password: form.password, termsAccepted: form.termsAccepted } })).message);
  };
  const sendLink = () => {
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return fail("Ingresa un correo válido.");
    return run(async () => (await apiRequest("/auth/password/forgot", { method: "POST", body: { email: form.email } })).message);
  };
  const resetPassword = () => {
    const error = validateReset(form);
    if (error) return fail(error);
    if (form.password !== form.confirm) return fail("Las contraseñas no coinciden.");
    return run(async () => (await apiRequest("/auth/password/reset", { method: "POST", body: { token: form.token, password: form.password } })).message);
  };

  const t = titles[screen];

  return (
    <Screen>
      <ScreenHeader eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} onBack={screen === "login" ? undefined : () => go("login")} />

      {screen === "login" ? (
        <>
          <Logo size={24} />
          <HeroCard tone="teal" title="Un hogar empieza con una conexión" subtitle="Personas, espacios y una convivencia que sí va contigo." />
          <View style={{ gap: 14 }}>
            <TextField label="Correo electrónico" placeholder="cesar@correo.com" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => update("email", v)} />
            <TextField label="Contraseña" placeholder="••••••••" secureTextEntry value={form.password} onChangeText={(v) => update("password", v)} />
            <LinkText onPress={() => go("recovery")}>¿Olvidaste tu contraseña?</LinkText>
            <Notice error={state.error} message={state.message} />
            <Button label="Iniciar sesión" loading={state.loading} onPress={login} />
            <GoogleButton label="Continuar con Google" disabled={state.loading} onPress={() => fail("Google OAuth se habilita con credenciales del proyecto.")} />
            <LinkText align="center" onPress={() => go("register")}>¿Eres nuevo? Crea tu cuenta</LinkText>
          </View>
        </>
      ) : null}

      {screen === "register" ? (
        <View style={{ gap: 14 }}>
          <TextField label="Nombre completo" placeholder="Cesar Bernal" value={form.fullName} onChangeText={(v) => update("fullName", v)} />
          <TextField label="Correo electrónico" placeholder="cesar@correo.com" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => update("email", v)} />
          <TextField label="Contraseña" placeholder="Mínimo 8 caracteres" secureTextEntry value={form.password} onChangeText={(v) => update("password", v)} />
          <Checkbox checked={form.termsAccepted} onToggle={(v) => update("termsAccepted", v)} title="Acepto los términos de servicio" subtitle="He leído el aviso de privacidad." />
          <Notice error={state.error} message={state.message} />
          <Button label="Crear mi cuenta" loading={state.loading} onPress={register} />
          <GoogleButton label="Registrarme con Google" disabled={state.loading} onPress={() => fail("Google OAuth se habilita con credenciales del proyecto.")} />
        </View>
      ) : null}

      {screen === "recovery" ? (
        <>
          <HeroCard tone="purple" title="¿Olvidaste tu contraseña?" subtitle="Escribe tu correo para recibir un enlace de recuperación." />
          <View style={{ gap: 14 }}>
            <TextField label="Correo electrónico" placeholder="cesar@correo.com" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => update("email", v)} />
            <Button label="Enviar enlace" loading={state.loading} onPress={sendLink} />
          </View>
          <View style={{ gap: 14, marginTop: 4 }}>
            <Label>Después de abrir el enlace</Label>
            <TextField label="Código del enlace" placeholder="Pégalo desde el correo" hint="Lo recibes en el enlace de recuperación." value={form.token} onChangeText={(v) => update("token", v)} />
            <TextField label="Nueva contraseña" placeholder="••••••••••" secureTextEntry value={form.password} onChangeText={(v) => update("password", v)} />
            <TextField label="Confirmar contraseña" placeholder="••••••••••" secureTextEntry value={form.confirm} onChangeText={(v) => update("confirm", v)} />
            <Notice error={state.error} message={state.message} />
            <Button label="Guardar nueva contraseña" variant="secondary" loading={state.loading} onPress={resetPassword} />
          </View>
        </>
      ) : null}

      <FooterNote />
    </Screen>
  );
}
