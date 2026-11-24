import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'

const api = new URL(process.env.E2E_API_URL ?? 'http://localhost:3000/api/v1')
const mobileWeb = process.env.E2E_QA_MOBILE_URL
const smtpInbox = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025'
const password = 'Qa!RoomLink-Test123'
const answers = { schedule: 3, cleanliness: 4, noise: 2, pets: 4, smoking: 1, visits: 3, genderPref: 3 }
const icon = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

async function call(path, { token, method = 'GET', body, want = 200 } = {}) {
  const options = { method, headers: {} }
  if (token) options.headers.Authorization = `Bearer ${token}`
  if (body instanceof FormData) options.body = body
  else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }
  const res = await fetch(api.href.replace(/\/$/, '') + path, options)
  const data = await res.json()
  expect(res.status, `${method} ${path} (${data.code ?? data.error ?? 'sin código'})`).toBe(want)
  return data
}

function loopback(url) {
  return ['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
}

test.beforeEach(({ baseURL }) => {
  if (![api.href, baseURL, smtpInbox].every((url) => url && loopback(url))) {
    throw new Error('Las pruebas con fixtures requieren servicios QA locales.')
  }
})

async function account(tag, withProfile = true) {
  const email = `qa-${tag}-${randomUUID()}@roomlink.test`
  await call('/auth/register', { method: 'POST', body: { email, password, termsAccepted: true }, want: 201 })
  const { token, user } = await call('/auth/login', { method: 'POST', body: { email, password } })
  if (withProfile) {
    await call('/profiles', { method: 'POST', token, body: { fullName: `RoomLink QA ${tag}`, birthDate: '1999-05-15' }, want: 201 })
    await call(`/compatibility/${user.id}`, { method: 'PUT', token, body: answers })
  }
  return { email, password, token, id: user.id }
}

async function grantQaAdmin(id) {
  const require = createRequire(new URL('../../../backend/package.json', import.meta.url))
  const mysql = require('mysql2/promise')
  const host = process.env.DB_HOST ?? '127.0.0.1'
  if (!loopback(`http://${host}`)) throw new Error('La base QA debe ser local.')
  const db = await mysql.createConnection({
    host, port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? 'roomlink',
    user: process.env.DB_USER ?? 'roomlink_app', password: process.env.DB_PASSWORD ?? 'roomlink_school',
  })
  try {
    const [records] = await db.execute('SELECT email FROM auth_users WHERE id = ?', [id])
    expect(records[0]?.email).toMatch(/^qa-admin-.*@roomlink\.test$/)
    await db.execute("INSERT INTO auth_user_roles(user_id, role) VALUES (?, 'admin')", [id])
  } finally {
    await db.end()
  }
}

async function login(page, user) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(user.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(user.password)
  const response = page.waitForResponse((res) => res.url().endsWith('/auth/login') && res.request().method() === 'POST')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  expect((await response).status()).toBe(200)
  await expect(page.getByRole('link', { name: 'Mi perfil' })).toBeVisible()
}

async function listing(token) {
  const form = new FormData()
  const title = `Habitación QA ${randomUUID().slice(0, 8)}`
  for (const [key, val] of Object.entries({
    titulo: title, renta: '3800', descripcion: 'Habitación para pruebas QA.',
    availableFrom: '2030-01-01', ubicacion: 'León, Guanajuato', latitude: '21.1221', longitude: '-101.683',
  })) form.append(key, val)
  for (let i = 0; i < 3; i++) form.append('photos', new Blob([icon], { type: 'image/png' }), `foto-${i}.png`)
  const room = await call('/rooms', { method: 'POST', token, body: form, want: 201 })
  await call(`/rooms/${room.id}/publish`, { method: 'PATCH', token })
  return { id: room.id, title }
}

test('buscador, arrendador y admin recorren postulación, chat y moderación', async ({ page, browser, baseURL }) => {
  const seeker = await account('buscador')
  const host = await account('arrendador')
  const admin = await account('admin', false)
  await grantQaAdmin(admin.id)
  const [hostContext, adminContext] = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })])
  try {
    const hostPage = await hostContext.newPage()
    const adminPage = await adminContext.newPage()
    await Promise.all([login(page, seeker), login(hostPage, host), login(adminPage, admin)])
    await call(`/profiles/${host.id}/verification/request`, { method: 'POST', token: host.token })
    await hostPage.goto('/perfil/cuenta')
    await hostPage.getByRole('checkbox', { name: /términos de responsabilidad/ }).check()
    await hostPage.getByRole('button', { name: 'Convertirme en arrendador' }).click()
    await expect(hostPage.getByText('Tu cuenta ya tiene el rol de arrendador.')).toBeVisible()
    await hostPage.reload()
    await expect(hostPage.getByText('Tu cuenta ya tiene el rol de arrendador.')).toBeVisible()
    const room = await listing(host.token)

    await page.goto(`/perfil/candidato/${host.id}`)
    await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Solicitud enviada' })).toBeDisabled()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Solicitud enviada' })).toBeDisabled()

    const application = await call('/applications', { method: 'POST', token: seeker.token, body: { listingId: room.id }, want: 201 })
    await call('/applications', { method: 'POST', token: seeker.token, body: { listingId: room.id }, want: 409 })
    expect(await call('/applications/me', { token: seeker.token })).toHaveLength(1)
    expect(await call('/applications/me', { token: host.token })).toEqual([])
    await call(`/applications/${application.id}/decide`, { method: 'PATCH', token: host.token, body: { decision: 'accept' } })

    await page.goto('/notificaciones')
    await expect(page.getByText('Tu postulación fue aceptada.')).toBeVisible()
    await page.getByRole('button', { name: 'Marcar todas como leídas' }).click()
    await expect(page.getByText('Sin leer: 0')).toBeVisible()

    const chat = await call('/messages/rooms', { method: 'POST', token: seeker.token, body: { applicationId: application.id }, want: 201 })
    await page.goto(`/mensajes/${chat.id}`)
    await page.getByRole('textbox', { name: 'Mensaje' }).fill('Mensaje de prueba entre roles')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await hostPage.bringToFront()
    await hostPage.goto(`/mensajes/${chat.id}`)
    await expect(hostPage.getByText('Mensaje de prueba entre roles', { exact: true }).last()).toBeVisible()
    await expect(page.getByText(/Leído/).last()).toBeVisible({ timeout: 15000 })
    await hostContext.setOffline(true)
    await hostContext.setOffline(false)
    await hostPage.reload()
    await expect(hostPage.getByText('Mensaje de prueba entre roles', { exact: true }).last()).toBeVisible()

    await page.goto(`/anuncios/${room.id}/denunciar`)
    await page.getByLabel('Motivo').selectOption('fraud')
    await page.getByRole('button', { name: 'Enviar denuncia' }).click()
    await expect(page.getByText(/^Denuncia enviada/)).toBeVisible()
    await call('/moderation/admin/queue', { token: seeker.token, want: 403 })
    await adminPage.goto('/admin/moderacion/denuncias')
    await expect(adminPage.locator('article').filter({ hasText: room.title })).toContainText('Prioridad alta')
    await adminPage.goto('/admin/moderacion/cola')
    const card = adminPage.locator('article').filter({ hasText: room.title })
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Aprobar' }).click()
    await card.getByRole('button', { name: 'Confirmar' }).click()
    await expect(card).toHaveCount(0)
    await adminPage.goto('/admin/moderacion/historial')
    await expect(adminPage.locator('article').filter({ hasText: room.title })).toContainText('Aprobado')
  } finally {
    await Promise.all([hostContext.close(), adminContext.close()])
  }
})

test('SMTP entrega el enlace y el reemplazo de contraseña revoca la sesión', async ({ page }) => {
  const user = await account('reset', false)
  await page.goto('/login')
  await page.getByRole('link', { name: /Olvidaste/ }).click()
  await page.getByLabel('Correo electrónico').fill(user.email)
  const queued = page.waitForResponse((res) => res.url().endsWith('/auth/password/forgot'))
  await page.getByRole('button', { name: /Solicitar instrucciones/ }).click()
  expect((await queued).ok()).toBeTruthy()

  let messageId
  await expect.poll(async () => {
    const res = await fetch(`${smtpInbox}/api/v1/search?query=${encodeURIComponent(`to:${user.email}`)}`)
    const data = await res.json()
    messageId = data.messages?.[0]?.ID
    return Boolean(messageId)
  }).toBe(true)
  const mail = await fetch(`${smtpInbox}/api/v1/message/${messageId}`).then((res) => res.json())
  const url = new URL(mail.Text.match(/https?:\/\/[^\s]+\/restablecer\?token=[^\s]+/)[0])
  expect(loopback(url)).toBe(true)
  const newPassword = 'Nueva!Password123'
  await page.goto(url.href)
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(newPassword)
  await page.getByLabel('Confirma la contraseña', { exact: true }).fill(newPassword)
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
  await call('/auth/me', { token: user.token, want: 401 })
  await call('/auth/password/reset', { method: 'POST', body: { token: url.searchParams.get('token'), password }, want: 400 })
  await login(page, { ...user, password: newPassword })
})

test('la PWA muestra su pantalla offline y permite volver al recuperar la red', async ({ page, context }) => {
  await page.goto('/login')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Estás sin conexión' })).toBeVisible()
  await context.setOffline(false)
  await page.getByRole('link', { name: 'Volver a intentar' }).click()
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
})

test('Explorar móvil conserva la postulación tras recargar Expo', async ({ page }) => {
  test.skip(!mobileWeb, 'Requiere el cliente Expo de QA.')
  expect(loopback(mobileWeb)).toBe(true)
  const seeker = await account('movil')
  const host = await account('movil-host')
  await call(`/profiles/${host.id}/verification/request`, { method: 'POST', token: host.token })
  await call('/auth/become-host', { method: 'POST', token: host.token, body: { acceptedTerms: true } })
  const room = await listing(host.token)
  await page.goto(mobileWeb)
  await page.getByTestId('login-email').fill(seeker.email)
  await page.getByTestId('login-password').fill(seeker.password)
  const signIn = page.waitForResponse((res) => res.url().endsWith('/auth/login') && res.request().method() === 'POST')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  expect((await signIn).status()).toBe(200)
  await expect(page).not.toHaveURL(/\/login(?:[?#]|$)/)
  await page.goto(new URL('/explorar', mobileWeb).href)
  const card = page.getByTestId(`habitacion-${room.id}`)
  await card.getByRole('button', { name: 'Postularme', exact: true }).click()
  await expect(card.getByText(/Postulación enviada/)).toBeVisible()
  await page.reload()
  await expect(card.getByText(/Postulación enviada/)).toBeVisible()
  expect(await call(`/applications/listing/${room.id}`, { token: host.token })).toHaveLength(1)
})

test('la navegación web permite saltar al contenido sin desbordar el móvil', async ({ page }) => {
  const user = await account('teclado', false)
  await login(page, user)
  await page.goto('/notificaciones')
  await expect(page.getByRole('heading', { name: 'Notificaciones' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#contenido')).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
