import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { apiRequest, readableError } from "../../api/client";
import { Action, Card, Field, ModuleLayout, Notice, palette } from "../../shared/ui";
import { validateLogin, validateRegistration, validateReset } from "./auth.logic";

export function AuthModule({ session, onSession }) {
  const [screen, setScreen] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", token: "", termsAccepted: false });
  const [state, setState] = useState({ loading: false, error: "", message: "" });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const run = async (operation) => { setState({ loading: true, error: "", message: "" }); try { const message = await operation(); setState({ loading: false, error: "", message: message ?? "Operación completada." }); } catch (error) { setState({ loading: false, error: readableError(error), message: "" }); } };
  const login = () => { const error = validateLogin(form); if (error) return setState({ loading: false, error, message: "" }); return run(async () => { const result = await apiRequest("/auth/login", { method: "POST", body: { email: form.email, password: form.password } }); onSession({ token: result.token, user: result.user }); return result.message; }); };
  const register = () => { const error = validateRegistration(form); if (error) return setState({ loading: false, error, message: "" }); return run(async () => (await apiRequest("/auth/register", { method: "POST", body: { email: form.email, password: form.password, termsAccepted: form.termsAccepted } })).message); };
  const recover = () => run(async () => (await apiRequest("/auth/password/forgot", { method: "POST", body: { email: form.email } })).message);
  const reset = () => { const error = validateReset(form); if (error) return setState({ loading: false, error, message: "" }); return run(async () => (await apiRequest("/auth/password/reset", { method: "POST", body: { token: form.token, password: form.password } })).message); };
  return <ModuleLayout title="Autenticación y acceso" description="Registro seguro, sesión y recuperación sin revelar si una cuenta existe." tabs={[["login", "Iniciar sesión"], ["register", "Registro"], ["recovery", "Recuperación"]]} active={screen} onTab={setScreen}>
    <Card title={screen === "login" ? "Bienvenido de vuelta" : screen === "register" ? "Crea tu cuenta" : "Recupera el acceso"}>
      <Field label="Correo" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(value) => update("email", value)} />
      {screen !== "recovery" || form.token ? <Field label={screen === "recovery" ? "Nueva contraseña" : "Contraseña"} secureTextEntry value={form.password} onChangeText={(value) => update("password", value)} /> : null}
      {screen === "register" ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Switch value={form.termsAccepted} onValueChange={(value) => update("termsAccepted", value)} trackColor={{ true: palette.primary }} /><Text style={{ color: palette.ink, flex: 1 }}>Acepto términos y condiciones.</Text></View> : null}
      {screen === "recovery" ? <Field label="Token (cuando lo recibas)" value={form.token} onChangeText={(value) => update("token", value)} /> : null}
      <Notice error={state.error} message={state.message} />
      {screen === "login" ? <Action label={state.loading ? "Ingresando…" : "Ingresar"} disabled={state.loading} onPress={login} /> : null}
      {screen === "register" ? <Action label={state.loading ? "Creando…" : "Crear cuenta"} disabled={state.loading} onPress={register} /> : null}
      {screen === "recovery" ? <><Action label="Solicitar recuperación" disabled={state.loading} onPress={recover} /><Action label="Restablecer contraseña" disabled={state.loading || !form.token} onPress={reset} /></> : null}
      {session.user ? <Text style={{ color: palette.primary }}>Sesión activa como {session.user.email}</Text> : null}
    </Card>
  </ModuleLayout>;
}
