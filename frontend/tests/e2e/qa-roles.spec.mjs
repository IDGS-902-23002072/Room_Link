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

async function withQaDatabase(work) {
  const require = createRequire(new URL('../../../backend/package.json', import.meta.url))
  const mysql = require('mysql2/promise')
  const host = process.env.DB_HOST ?? '127.0.0.1'
  if (!loopback(`http://${host}`)) throw new Error('La base QA debe ser local.')
  const db = await mysql.createConnection({
    host, port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME ?? 'roomlink',
    user: process.env.DB_USER ?? 'roomlink_app', password: process.env.DB_PASSWORD ?? 'roomlink_school',
  })
  try {
    return await work(db)
  } finally {
    await db.end()
  }
}

async function grantQaAdmin(id) {
  return withQaDatabase(async (db) => {
    const [records] = await db.execute('SELECT email FROM auth_users WHERE id = ?', [id])
    expect(records[0]?.email).toMatch(/^qa-admin-.*@roomlink\.test$/)
    await db.execute("INSERT INTO auth_user_roles(user_id, role) VALUES (?, 'admin')", [id])
  })
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

async function listing(token, { publish = true } = {}) {
  const form = new FormData()
  const title = `Habitación QA ${randomUUID().slice(0, 8)}`
  for (const [key, val] of Object.entries({
    titulo: title, renta: '3800', descripcion: 'Habitación para pruebas QA.',
    availableFrom: '2030-01-01', ubicacion: 'León, Guanajuato', latitude: '21.1221', longitude: '-101.683',
  })) form.append(key, val)
  for (let i = 0; i < 3; i++) form.append('photos', new Blob([icon], { type: 'image/png' }), `foto-${i}.png`)
  const room = await call('/rooms', { method: 'POST', token, body: form, want: 201 })
  if (!publish) return { id: room.id, title }
  await call(`/rooms/${room.id}/rules`, { method: 'PUT', token, body: { petsAllowed: true } })
  await call(`/rooms/${room.id}/costs`, {
    method: 'PUT', token, body: { items: [{ kind: 'other', concept: 'Sin cargos adicionales', amount: 0, isIncluded: true }] },
  })
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
    await hostPage.goto('/notificaciones')
    await expect(hostPage.getByText('Tu anuncio fue aprobado.', { exact: true })).toBeVisible()
  } finally {
    await Promise.all([hostContext.close(), adminContext.close()])
  }
})

test('web publica con reglas y costos, conserva la postulación y permite cerrar el anuncio', async ({ page, browser, baseURL }) => {
  const seeker = await account('buscador-web')
  const host = await account('anfitrion-web')
  const hostContext = await browser.newContext({ baseURL })
  const hostPage = await hostContext.newPage()
  const title = `Habitación web QA ${randomUUID().slice(0, 8)}`
  const tile = { contentType: 'image/png', body: icon }
  await Promise.all([
    page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill(tile)),
    hostPage.route('https://tile.openstreetmap.org/**', (route) => route.fulfill(tile)),
  ])
  try {
    await Promise.all([login(page, seeker), login(hostPage, host)])
    await call(`/profiles/${host.id}/verification/request`, { method: 'POST', token: host.token })
    await hostPage.goto('/perfil/cuenta')
    await hostPage.getByRole('checkbox', { name: /términos de responsabilidad/ }).check()
    await hostPage.getByRole('button', { name: 'Convertirme en arrendador' }).click()
    await hostPage.getByRole('link', { name: 'Mis habitaciones' }).click()
    await hostPage.getByRole('link', { name: 'Nueva habitación' }).click()
    await hostPage.getByLabel('Título').fill(title)
    await hostPage.getByLabel('Renta mensual en MXN').fill('3800')
    await hostPage.getByLabel('Disponible a partir de').fill('2030-01-01')
    await hostPage.getByLabel('Descripción').fill('Habitación amueblada para probar la publicación web.')
    if (process.env.E2E_QA_MAP_FIXTURES) {
      await hostPage.getByRole('searchbox', { name: 'Buscar dirección o colonia' }).fill('Centro de León QA')
      await hostPage.getByRole('button', { name: 'Buscar en el mapa' }).click()
      await hostPage.getByRole('button', { name: 'Centro de León, Guanajuato' }).click()
      await expect(hostPage.getByLabel('Dirección', { exact: true })).toHaveValue('Centro de León, Guanajuato')
      await expect(hostPage.getByLabel('Latitud')).toHaveValue('21.1221')
    } else {
      await hostPage.getByLabel('Dirección', { exact: true }).fill('León, Guanajuato')
    }
    await hostPage.getByRole('region', { name: 'Mapa para elegir la ubicación' }).click({ position: { x: 120, y: 110 } })
    await expect(hostPage.getByLabel('Latitud')).not.toHaveValue('')
    await hostPage.getByLabel('Agregar fotos').setInputFiles(Array.from({ length: 2 }, (_, index) => ({
      name: `foto-${index}.png`, mimeType: 'image/png', buffer: icon,
    })))
    await hostPage.getByRole('button', { name: 'Guardar y continuar a reglas y costos' }).click()
    await expect(hostPage.getByRole('button', { name: 'Publicar habitación' })).toBeDisabled()
    const draftId = new URL(hostPage.url()).pathname.split('/').at(-1)
    await call(`/geolocation/rooms/${draftId}/nearby`, { token: seeker.token, want: 404 })
    const incomplete = await call(`/rooms/${draftId}/publish`, { method: 'PATCH', token: host.token, want: 400 })
    expect(incomplete.error).toMatch(/al menos 3 fotografías/)
    await call(`/rooms/${draftId}/rules`, { method: 'PUT', token: host.token, body: { petsAllowed: true } })
    await call(`/rooms/${draftId}/costs`, { method: 'PUT', token: host.token, body: { items: [] }, want: 400 })
    await call(`/rooms/${draftId}/publish`, { method: 'PATCH', token: host.token, want: 400 })
    await hostPage.getByLabel('Permitir mascotas').check()
    await hostPage.getByLabel('Política de visitas').fill('Avisar con un día de anticipación')
    await hostPage.getByRole('button', { name: 'Agregar concepto' }).click()
    await hostPage.getByLabel('Tipo').selectOption('deposit')
    await hostPage.getByLabel('Nombre del concepto').fill('Depósito reembolsable')
    await hostPage.getByLabel('Monto en MXN').fill('1900')
    await hostPage.getByRole('button', { name: 'Guardar reglas y costos' }).click()
    await expect(hostPage.getByText('Reglas y costos guardados.')).toBeVisible()
    await expect(hostPage.getByRole('button', { name: 'Publicar habitación' })).toBeDisabled()
    await expect(hostPage.getByText('Falta una foto para publicar.')).toBeVisible()
    await hostPage.getByRole('button', { name: 'Datos y fotos' }).click()
    await hostPage.getByLabel('Descripción').fill('Habitación amueblada editada para probar la publicación web.')
    await hostPage.getByLabel('Agregar fotos').setInputFiles({ name: 'tercera.png', mimeType: 'image/png', buffer: icon })
    await hostPage.getByRole('button', { name: 'Guardar datos del anuncio' }).click()
    await expect(hostPage.getByLabel('Nombre del concepto')).toHaveValue('Depósito reembolsable')
    const edited = await call(`/rooms/${draftId}`, { token: host.token })
    expect(edited).toMatchObject({ photosCount: 3, description: 'Habitación amueblada editada para probar la publicación web.' })
    expect(edited.costItems[0]).toMatchObject({ concept: 'Depósito reembolsable', amount: 1900 })
    const validationDraft = await listing(host.token, { publish: false })
    const missingTerms = await call(`/rooms/${validationDraft.id}/publish`, { method: 'PATCH', token: host.token, want: 400 })
    expect(missingTerms.error).toMatch(/reglas y el desglose de costos/)
    await hostPage.getByRole('button', { name: 'Guardar reglas y costos' }).click()
    await hostPage.getByRole('button', { name: 'Publicar habitación' }).click()
    await expect(hostPage.getByRole('button', { name: 'Pausar anuncio' })).toBeVisible()
    await hostPage.getByRole('button', { name: 'Pausar anuncio' }).click()
    await hostPage.getByRole('button', { name: 'Reactivar anuncio' }).click()
    await expect(hostPage.getByRole('button', { name: 'Pausar anuncio' })).toBeVisible()
    const listingId = new URL(hostPage.url()).pathname.split('/').at(-1)

    await page.getByRole('link', { name: 'Explorar habitaciones' }).click()
    await page.getByRole('searchbox').fill(title)
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await page.getByRole('link', { name: title, exact: true }).click()
    await expect(page.getByText('Depósito reembolsable')).toBeVisible()
    await expect(page.getByText('Avisar con un día de anticipación')).toBeVisible()
    const map = page.getByRole('region', { name: 'Mapa de ubicación de la habitación' })
    await map.getByRole('button', { name: 'Acercar' }).click()
    await expect(map.getByRole('link', { name: 'OpenStreetMap', exact: true })).toBeVisible()
    if (process.env.E2E_QA_MAP_FIXTURES) {
      await page.route('**/api/v1/geolocation/rooms/*/nearby', (route) => route.fulfill({
        status: 503, json: { error: 'El servicio de mapas no está disponible en este momento.' },
      }), { times: 1 })
      await page.getByRole('button', { name: 'Ver lugares cercanos' }).click()
      await expect(page.getByRole('alert')).toContainText('El servicio de mapas no está disponible')
      await expect(map).toBeVisible()
      await expect(page.getByRole('link', { name: 'Abrir en OpenStreetMap' })).toBeVisible()
      await page.getByRole('button', { name: 'Ver lugares cercanos' }).click()
      const pharmacy = page.getByRole('button', { name: /Farmacia de prueba · \d+ m/ })
      await pharmacy.click()
      await expect(pharmacy).toHaveAttribute('aria-pressed', 'true')
      await expect(map.locator('.leaflet-overlay-pane path')).toHaveCount(2)
    }
    await page.getByLabel('Mensaje para el anfitrión (opcional)').fill('Me interesa conocer la habitación.')
    await page.getByRole('button', { name: 'Enviar postulación' }).click()
    await expect(page.getByText('Postulación enviada')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Postulación enviada')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar postulación' })).toHaveCount(0)
    expect(await call('/applications/me', { token: seeker.token })).toHaveLength(1)
    await call('/applications', { method: 'POST', token: seeker.token, body: { listingId }, want: 409 })

    await hostPage.getByRole('link', { name: 'Ver postulaciones' }).click()
    await expect(hostPage.getByRole('heading', { name: 'RoomLink QA buscador-web' })).toBeVisible()
    await expect(hostPage.getByText(/\d+% de afinidad/)).toBeVisible()
    const [application] = await call('/applications/me', { token: seeker.token })
    const decisionPath = `/applications/${application.id}/decide`
    await expect(hostPage.locator(`time[datetime="${application.createdAt}"]`)).toBeVisible()
    const rejected = await account('rechazo-web')
    await call('/applications', { token: rejected.token, method: 'POST', body: { listingId }, want: 201 })
    await hostPage.reload()
    const rejectedCard = hostPage.locator('article').filter({ has: hostPage.getByRole('heading', { name: 'RoomLink QA rechazo-web' }) })
    await rejectedCard.getByRole('button', { name: 'Rechazar', exact: true }).click()
    await expect(rejectedCard.getByText('Rechazada', { exact: true })).toBeVisible()
    const rejectedInbox = await call('/notifications', { token: rejected.token })
    expect(rejectedInbox.items).toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Tu postulación fue rechazada.' })]))
    await call(decisionPath, { method: 'PATCH', token: seeker.token, body: { decision: 'waitlist' }, want: 403 })
    await hostPage.getByRole('button', { name: 'Poner en lista de espera' }).click()
    await expect(hostPage.getByText('En lista de espera', { exact: true })).toBeVisible()
    await hostPage.reload()
    await expect(hostPage.getByText('En lista de espera', { exact: true })).toBeVisible()
    await call(decisionPath, { method: 'PATCH', token: host.token, body: { decision: 'waitlist' }, want: 409 })
    await page.goto('/notificaciones')
    await expect(page.getByText('Tu postulación quedó en lista de espera.')).toBeVisible()
    await page.locator('article').filter({ hasText: 'Tu postulación quedó en lista de espera.' }).getByRole('link', { name: 'Ver mis postulaciones' }).click()
    await expect(page.getByText('En lista de espera', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abrir conversación' })).toHaveCount(0)
    await hostPage.getByRole('button', { name: 'Aceptar', exact: true }).click()
    await expect(hostPage.getByText('¿Ya encontraste roomie?')).toBeVisible()
    await hostPage.getByRole('button', { name: 'Cerrar anuncio' }).click()
    await expect(hostPage.getByText('Anuncio cerrado.')).toBeVisible()
    await page.goto('/notificaciones')
    await expect(page.getByText('Tu postulación fue aceptada.')).toBeVisible()
    await page.locator('article').filter({ hasText: 'Tu postulación fue aceptada.' }).getByRole('link', { name: 'Ver mis postulaciones' }).click()
    await expect(page.getByText('Aceptada', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Abrir conversación' }).click()
    await expect(page).toHaveURL(/\/mensajes\/[^/]+$/)
  } finally {
    await hostContext.close()
  }
})

test('HU-01 registra con términos, muestra los errores por campo y bloquea tras cinco intentos', async ({ page }) => {
  const accountEmail = `qa-registro-${randomUUID()}@roomlink.test`
  const registration = page.getByRole('region', { name: 'Crea tu cuenta' })
  const email = registration.getByLabel('Correo electrónico')
  const pass = registration.getByLabel('Contraseña', { exact: true })
  const terms = registration.getByRole('checkbox')
  const create = registration.getByRole('button', { name: 'Crear cuenta', exact: true })
  await page.goto('/registro')
  await email.fill(accountEmail)
  await pass.fill('1234567')
  await create.click()
  await expect(pass).toHaveAccessibleDescription('La contraseña debe tener al menos 8 caracteres.')
  await pass.fill(password)
  await create.click()
  await expect(terms).toHaveAccessibleDescription('Acepta los términos de servicio para continuar.')
  await terms.check()
  await create.click()
  await expect(page.getByText('Tu cuenta está lista. Ya puedes iniciar sesión.')).toBeVisible()
  await page.goto('/registro')
  await email.fill(accountEmail)
  await pass.fill(password)
  await terms.check()
  await create.click()
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await page.goto('/login')
  const loginForm = page.getByRole('region', { name: 'Inicia sesión' })
  await loginForm.getByLabel('Correo electrónico').fill(accountEmail)
  const loginPassword = loginForm.getByLabel('Contraseña', { exact: true })
  await loginPassword.fill('WrongPass!123')
  const submit = loginForm.getByRole('button', { name: 'Iniciar sesión', exact: true })
  for (let attempt = 0; attempt < 5; attempt++) {
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().endsWith('/auth/login') && res.request().method() === 'POST'),
      submit.click(),
    ])
    expect(response.status()).toBe(401)
  }
  await loginPassword.fill(password)
  await submit.click()
  await expect(loginForm.getByRole('alert')).toContainText(/bloqueada/i)
})

test('HU-03 y HU-04 guardan las siete respuestas y ordenan los perfiles por afinidad', async ({ page }) => {
  const viewer = await account('afinidad-viewer', false)
  const low = await account('afinidad-baja')
  const featuredTag = 'afinidad-alta-' + randomUUID().slice(0, 8)
  const high = await account(featuredTag)
  await call(`/profiles`, { method: 'POST', token: viewer.token, body: { fullName: 'Visor afinidad', birthDate: '1999-05-15' }, want: 201 })
  const all = (value) => Object.fromEntries(Object.keys(answers).map((key) => [key, value]))
  await call(`/compatibility/${low.id}`, { method: 'PUT', token: low.token, body: all(5) })
  await call(`/compatibility/${high.id}`, { method: 'PUT', token: high.token, body: all(1) })
  const zone = 'Zona afinidad ' + randomUUID().slice(0, 8)
  await withQaDatabase(async (db) => {
    const zoneId = randomUUID()
    await db.execute('INSERT INTO geo_zones (id, name, city) VALUES (?, ?, ?)', [zoneId, zone, 'León'])
    await db.execute('INSERT INTO profile_housing_preferences (user_id, desired_zone_id, budget_min, budget_max) VALUES (?, ?, ?, ?)', [high.id, zoneId, 3200, 4700])
  })
  const photo = new FormData()
  photo.append('photo', new Blob([icon], { type: 'image/png' }), 'candidato.png')
  const gallery = await call(`/profiles/${high.id}/photos`, {
    method: 'POST', token: high.token, body: photo, want: 201,
  })
  await login(page, viewer)
  await expect(page.getByRole('link', { name: 'Hacer mi test' })).toBeVisible()
  await expect(page.locator('.compatibility-badge')).toHaveCount(0)
  await page.getByRole('link', { name: 'Hacer mi test' }).click()
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  for (let index = 0; index < 7; index++) {
    await page.locator('.answer-option').first().click()
    await page.getByRole('button', { name: index === 6 ? 'Ver resultados' : 'Siguiente' }).click()
  }
  const dimensions = page.locator('.result-dimension')
  await expect(dimensions).toHaveCount(7)
  await expect(dimensions.first()).toContainText('0%')
  await page.getByRole('button', { name: 'Guardar respuestas' }).click()
  await expect(page.getByText('Tus respuestas se guardaron correctamente.')).toBeVisible()
  await page.reload()
  await expect(dimensions).toHaveCount(7)
  await page.getByRole('button', { name: 'Editar respuestas' }).click()
  await page.locator('.answer-option').last().click()
  await page.getByRole('button', { name: 'Finalizar y guardar test' }).click()
  await expect(dimensions.first()).toContainText('100%')
  await expect(page.getByText('Tus respuestas se guardaron correctamente.')).toBeVisible()
  await page.getByRole('link', { name: 'Ver roomies compatibles' }).click()
  const cards = page.locator('.candidate-card')
  const featured = cards.filter({ hasText: 'RoomLink QA ' + featuredTag })
  await expect(featured.getByRole('heading')).toContainText(new RegExp(`RoomLink QA ${featuredTag}, \\d+`))
  await expect(featured.locator('img')).toHaveAttribute('src', gallery.items[0].url)
  await expect(featured).toContainText(zone)
  await expect(featured).toContainText('León')
  await expect(featured).toContainText(/3,200.*4,700/)
  const scores = (await cards.locator('.compatibility-badge').allTextContents()).map(Number.parseFloat)
  expect(scores.length).toBeGreaterThan(1)
  expect(scores).toEqual([...scores].sort((a, b) => b - a))
  const search = page.getByPlaceholder('Buscar por nombre, zona o intereses')
  await search.fill('sin coincidencias ' + randomUUID())
  await expect(page.getByRole('heading', { name: 'No encontramos coincidencias' })).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await expect(cards.first()).toBeVisible()
})

test('HU-05 combina zona, presupuesto y edad con total coherente, cero resultados y limpieza', async ({ page }) => {
  const viewer = await account('hu05-viewer')
  const candTag = 'hu05-cand-' + randomUUID().slice(0, 8)
  const candName = 'RoomLink QA ' + candTag
  const candidate = await account(candTag)
  // Zona y ciudad únicas: aíslan al candidato aunque la base QA tenga muchos perfiles.
  const suffix = randomUUID().slice(0, 8)
  const zoneName = 'ZonaHU05 ' + suffix
  const cityName = 'CiudadHU05 ' + suffix
  await withQaDatabase(async (db) => {
    const zoneId = randomUUID()
    await db.execute('INSERT INTO geo_zones (id, name, city) VALUES (?, ?, ?)', [zoneId, zoneName, cityName])
    await db.execute(
      'INSERT INTO profile_housing_preferences (user_id, desired_zone_id, budget_min, budget_max) VALUES (?, ?, ?, ?)',
      [candidate.id, zoneId, 3000, 5000],
    )
  })

  await login(page, viewer)
  await page.goto('/buscar')
  const total = page.getByRole('status').filter({ hasText: /perfil(es)? encontrad/ })

  // 1) Zona + ciudad únicas → exactamente un perfil.
  await page.getByLabel('Ciudad').selectOption(cityName)
  await page.getByRole('checkbox', { name: zoneName }).check()
  await page.getByRole('button', { name: 'Aplicar filtros' }).click()
  await expect(total).toHaveText('1 perfil encontrado')
  await expect(page.getByRole('heading', { name: new RegExp(candName) })).toBeVisible()

  // 2) Combinar con presupuesto y edad que SÍ incluyen al candidato → sigue habiendo total coherente.
  await page.getByLabel('Mínimo').fill('3000')
  await page.getByLabel('Máximo').fill('5000')
  await page.getByLabel('Desde').fill('25')
  await page.getByLabel('Hasta').fill('30')
  await page.getByRole('button', { name: 'Aplicar filtros' }).click()
  await expect(total).toHaveText('1 perfil encontrado')
  await expect(page.getByRole('heading', { name: new RegExp(candName) })).toBeVisible()

  // 3) Un presupuesto válido pero sin solape con el del candidato deja cero resultados.
  await page.getByLabel('Mínimo').fill('10000')
  await page.getByLabel('Máximo').fill('20000')
  await page.getByRole('button', { name: 'Aplicar filtros' }).click()
  await expect(total).toHaveText('0 perfiles encontrados')
  await expect(page.getByText(/Sin coincidencias/)).toBeVisible()

  // 4) Limpiar filtros restaura resultados (sin el mensaje de cero).
  await page.getByRole('button', { name: 'Restablecer filtros' }).click()
  await expect(page.getByText(/Sin coincidencias/)).toHaveCount(0)
  await expect(total).not.toHaveText('0 perfiles encontrados')
})

test('M10 abre chat desde una conexión aceptada y conserva el mensaje al recargar', async ({ page, browser, baseURL }) => {
  const sender = await account('chat-origen')
  const receiver = await account('chat-receptor')
  const other = await account('chat-ajeno', false)
  const connection = await call(`/compatibility/${sender.id}/connections`, {
    method: 'POST', token: sender.token, body: { candidateId: receiver.id, introMessage: 'Hola' }, want: 201,
  })
  await login(page, sender)
  await page.goto('/mensajes')
  const chatEntry = page.getByRole('button', { name: /RoomLink QA chat-receptor/ })
  await expect(chatEntry).toHaveCount(0)
  await call(`/connections/${connection.id}`, { method: 'PATCH', token: receiver.token, body: { decision: 'accept' } })
  await page.reload()
  await chatEntry.click()
  await expect(page).toHaveURL(/\/mensajes\/[^/]+$/)
  const roomId = new URL(page.url()).pathname.split('/').at(-1)
  await page.getByRole('button', { name: 'Detalles', exact: true }).click()
  await expect(page.getByText('Conexión aceptada', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Mensaje' }).fill('Conversación desde una conexión')
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  await call(`/messages/rooms/${roomId}/messages`, { token: other.token, want: 403 })
  const context = await browser.newContext({ baseURL })
  try {
    const incoming = await context.newPage()
    await login(incoming, receiver)
    await incoming.goto(`/mensajes/${roomId}`)
    await expect(incoming.getByText('Conversación desde una conexión', { exact: true }).last()).toBeVisible()
    await incoming.reload()
    await expect(incoming.getByText('Conversación desde una conexión', { exact: true }).last()).toBeVisible()
  } finally {
    await context.close()
  }
})

test('M14 guarda preferencias web y respeta el aviso de conexión', async ({ page }) => {
  const recipient = await account('avisos-receptor')
  const first = await account('avisos-primero')
  const second = await account('avisos-segundo')
  const send = (actor) => call(`/compatibility/${actor.id}/connections`, {
    method: 'POST', token: actor.token, body: { candidateId: recipient.id, introMessage: null }, want: 201,
  })
  await login(page, recipient)
  await page.goto('/perfil/cuenta')
  const preference = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Notificaciones web', exact: true }),
  }).last().getByRole('switch', { name: /Solicitudes de conexión/ })
  const save = page.getByRole('button', { name: 'Guardar cambios' })
  await expect(preference).toBeChecked()
  await preference.click()
  await save.click()
  await expect(page.getByText('Preferencias guardadas.')).toBeVisible()
  await page.reload()
  await expect(preference).not.toBeChecked()
  const disabled = await send(first)
  const initial = await call('/notifications', { token: recipient.token })
  expect(initial.items.some((item) => item.payload?.connectionId === disabled.id)).toBe(false)
  await preference.click()
  await save.click()
  await expect(page.getByText('Preferencias guardadas.')).toBeVisible()
  await send(second)
  await page.goto('/notificaciones')
  await expect(page.getByText('Recibiste una solicitud de conexión.', { exact: true })).toBeVisible()
})

test('HU-02 revela el contacto solo a conexiones según la privacidad y M02 aprueba la identidad', async ({ page, browser, baseURL }) => {
  const ownerTag = 'privacidad-dueno-' + randomUUID().slice(0, 8)
  const ownerName = 'RoomLink QA ' + ownerTag
  const owner = await account(ownerTag)
  const connected = await account('privacidad-conexion')
  const stranger = await account('privacidad-ajeno')
  const admin = await account('admin', false)
  await grantQaAdmin(admin.id)

  // El dueño registra teléfono e Instagram.
  await call(`/profiles/${owner.id}`, { method: 'PUT', token: owner.token, body: { fullName: ownerName, phone: '4770001122' } })
  await call(`/profiles/${owner.id}/socials`, { method: 'PUT', token: owner.token, body: { instagram: '@roomlink_qa' } })

  // Conexión aceptada entre el dueño y la cuenta "conectada".
  const connection = await call(`/compatibility/${connected.id}/connections`, {
    method: 'POST', token: connected.token, body: { candidateId: owner.id, introMessage: 'Hola' }, want: 201,
  })
  await call(`/connections/${connection.id}`, { method: 'PATCH', token: owner.token, body: { decision: 'accept' } })

  // Una cuenta ajena (sin conexión) no ve ningún dato de contacto.
  const strangerView = await call(`/profiles/${owner.id}`, { token: stranger.token })
  expect(strangerView.phone, 'ajeno sin teléfono').toBeNull()
  expect(strangerView.instagram, 'ajeno sin redes').toBeNull()
  expect(strangerView.email ?? null, 'ajeno sin correo').toBeNull()

  // La conexión ve teléfono y redes por defecto, pero NO el correo.
  const connectedBefore = await call(`/profiles/${owner.id}`, { token: connected.token })
  expect(connectedBefore.phone, 'conexión ve teléfono por defecto').toBe('4770001122')
  expect(connectedBefore.instagram, 'conexión ve redes por defecto').toContain('roomlink_qa')
  expect(connectedBefore.email ?? null, 'correo oculto por defecto').toBeNull()

  // El dueño habilita "Compartir correo" desde el panel de privacidad fusionado.
  await login(page, owner)
  await page.goto('/perfil/cuenta')
  const privacy = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Privacidad de contacto' }) })
  await privacy.getByRole('switch', { name: 'Compartir correo' }).check()
  await privacy.getByRole('button', { name: 'Guardar privacidad' }).click()
  await expect(page.getByText('Privacidad guardada.')).toBeVisible()

  // Ahora la conexión ve el correo; el ajeno sigue sin verlo.
  const connectedAfter = await call(`/profiles/${owner.id}`, { token: connected.token })
  expect(connectedAfter.email, 'conexión ve el correo tras habilitarlo').toBe(owner.email)
  const strangerAfter = await call(`/profiles/${owner.id}`, { token: stranger.token })
  expect(strangerAfter.email ?? null, 'el ajeno sigue sin ver el correo').toBeNull()

  // El dueño revoca el correo y vuelve a ocultarse.
  await privacy.getByRole('switch', { name: 'Compartir correo' }).uncheck()
  await privacy.getByRole('button', { name: 'Guardar privacidad' }).click()
  await expect(page.getByText('Privacidad guardada.')).toBeVisible()
  const revoked = await call(`/profiles/${owner.id}`, { token: connected.token })
  expect(revoked.email ?? null, 'tras revocar, sin correo').toBeNull()
  expect(revoked.phone, 'el teléfono sigue visible').toBe('4770001122')

  // M02 — el dueño pide verificación y el admin la aprueba desde /admin/identidad.
  await call(`/profiles/${owner.id}/verification/request`, { method: 'POST', token: owner.token })
  const adminContext = await browser.newContext({ baseURL })
  try {
    const adminPage = await adminContext.newPage()
    await login(adminPage, admin)
    await adminPage.goto('/admin/identidad')
    await expect(adminPage.getByRole('heading', { name: 'Solicitudes de identidad' })).toBeVisible()
    const card = adminPage.locator('section').filter({ hasText: ownerName })
    for (let i = 0; i < 12 && (await card.count()) === 0; i++) {
      const next = adminPage.getByRole('button', { name: 'Siguiente' })
      if ((await next.count()) === 0 || !(await next.isEnabled())) break
      await next.click()
      await adminPage.waitForLoadState('networkidle')
    }
    await expect(card).toBeVisible()
    adminPage.once('dialog', (dialog) => dialog.accept())
    await card.getByRole('button', { name: 'Aprobar' }).click()
    await expect(adminPage.getByText('Identidad verificada.')).toBeVisible()
  } finally {
    await adminContext.close()
  }
  const verified = await call(`/profiles/${owner.id}`, { token: owner.token })
  expect(verified.identityStatus, 'identidad verificada').toBe('verified')
})

test('SMTP entrega el enlace y el reemplazo de contraseña revoca la sesión', async ({ page }) => {
  const user = await account('reset', false)
  await page.goto('/login')
  await page.getByRole('link', { name: /Olvidaste/ }).click()
  const recovery = page.getByRole('region', { name: 'Recupera tu acceso' })
  const email = recovery.getByLabel('Correo electrónico')
  await email.fill(user.email)
  await expect(email).toHaveValue(user.email)
  const [queued] = await Promise.all([
    page.waitForResponse((res) => res.url().endsWith('/auth/password/forgot') && res.request().method() === 'POST'),
    recovery.getByRole('button', { name: 'Solicitar instrucciones' }).click(),
  ])
  expect(queued.ok()).toBeTruthy()

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

async function loginMobile(page, user) {
  await page.goto(mobileWeb)
  await page.getByTestId('login-email').fill(user.email)
  await page.getByTestId('login-password').fill(user.password)
  const signIn = page.waitForResponse((res) => res.url().endsWith('/auth/login') && res.request().method() === 'POST')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  expect((await signIn).status()).toBe(200)
  await expect(page).not.toHaveURL(/\/login(?:[?#]|$)/)
}

test('Explorar móvil conserva la postulación tras recargar Expo', async ({ page }) => {
  test.skip(!mobileWeb, 'Requiere el cliente Expo de QA.')
  expect(loopback(mobileWeb)).toBe(true)
  const seeker = await account('movil')
  const host = await account('movil-host')
  await call(`/profiles/${host.id}/verification/request`, { method: 'POST', token: host.token })
  await call('/auth/become-host', { method: 'POST', token: host.token, body: { acceptedTerms: true } })
  const room = await listing(host.token)
  await loginMobile(page, seeker)
  await page.goto(new URL('/explorar', mobileWeb).href)
  const card = page.getByTestId(`habitacion-${room.id}`)
  await card.getByRole('button', { name: 'Postularme', exact: true }).click()
  await expect(card.getByText(/Postulación enviada/)).toBeVisible()
  await page.reload()
  await expect(card.getByText(/Postulación enviada/)).toBeVisible()
  expect(await call(`/applications/listing/${room.id}`, { token: host.token })).toHaveLength(1)
})

test('Expo publica un borrador con reglas y costos y resuelve la lista de espera', async ({ page }) => {
  test.skip(!mobileWeb, 'Requiere el cliente Expo de QA.')
  expect(loopback(mobileWeb)).toBe(true)
  const seeker = await account('buscador-expo')
  const host = await account('host-expo')
  await call(`/profiles/${host.id}/verification/request`, { method: 'POST', token: host.token })
  await call('/auth/become-host', { method: 'POST', token: host.token, body: { acceptedTerms: true } })
  const room = await listing(host.token, { publish: false })

  await loginMobile(page, host)
  await page.goto(new URL('/anuncios', mobileWeb).href)
  await page.getByText(/^Borradores 1$/).click()
  await expect(page.getByText(room.title)).toBeVisible()
  await page.getByText('Editar', { exact: true }).click()
  await page.getByText('Continuar para publicar', { exact: true }).click()
  if (process.env.E2E_QA_MAP_FIXTURES) {
    await page.getByRole('textbox', { name: 'Dirección o colonia' }).fill('Centro de León QA')
    await expect(page.getByRole('button', { name: 'Continuar a fotografías' })).toBeDisabled()
    await page.getByRole('button', { name: 'Buscar ubicación' }).click()
    await page.getByRole('button', { name: 'Centro de León, Guanajuato' }).click()
  }
  await page.getByRole('button', { name: 'Continuar a fotografías' }).click()
  await page.getByText('Enviar anuncio a revisión', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Reglas y costos' })).toBeVisible()
  await page.getByRole('button', { name: 'Guardar y publicar habitación' }).click()
  await expect(page.getByText('Indica un costo o confirma que no hay cargos adicionales.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Política de visitas' }).fill('Avisar antes de llegar')
  await page.getByRole('switch', { name: 'Sin cargos adicionales' }).click()
  await page.getByRole('button', { name: 'Guardar y publicar habitación' }).click()
  await expect.poll(async () => (await call(`/rooms/${room.id}`, { token: host.token })).status).toBe('published')
  const published = await call(`/rooms/${room.id}`, { token: host.token })
  expect(published.rules.visitsPolicy).toBe('Avisar antes de llegar')
  expect(published.costItems[0]).toMatchObject({ concept: 'Sin cargos adicionales', amount: 0 })

  const application = await call('/applications', { token: seeker.token, method: 'POST', body: { listingId: room.id }, want: 201 })
  await page.goto(new URL(`/postulaciones?listingId=${room.id}`, mobileWeb).href)
  await page.getByText('RoomLink QA buscador-expo', { exact: true }).click()
  await page.getByText('Evaluar solicitud', { exact: true }).click()
  await page.getByText('Poner en lista de espera', { exact: true }).click()
  await expect(page.getByText(/EN LISTA DE ESPERA/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/EN LISTA DE ESPERA/)).toBeVisible()
  await page.getByText('RoomLink QA buscador-expo', { exact: true }).click()
  await page.getByText('Evaluar solicitud', { exact: true }).click()
  await page.getByText('Rechazar postulación', { exact: true }).click()
  await expect(page.getByText(/RECHAZADA/)).toBeVisible()
  const [result] = await call('/applications/me', { token: seeker.token })
  expect(result).toMatchObject({ id: application.id, status: 'rejected' })
  const accepted = await account('aceptado-expo')
  await call('/applications', { token: accepted.token, method: 'POST', body: { listingId: room.id }, want: 201 })
  await page.reload()
  await page.getByText('RoomLink QA aceptado-expo', { exact: true }).click()
  await page.getByText('Evaluar solicitud', { exact: true }).click()
  await page.getByText('Aceptar postulación', { exact: true }).click()
  await expect(page.getByText('¿Ya encontraste roomie?')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar anuncio' }).click()
  await expect(page.getByText('Anuncio cerrado.')).toBeVisible()
  await expect.poll(async () => (await call(`/rooms/${room.id}`, { token: host.token })).status).toBe('closed')
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
