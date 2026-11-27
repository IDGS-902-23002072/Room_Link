import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'

const api = new URL(process.env.E2E_API_URL ?? 'http://localhost:3000/api/v1')
const mobileWeb = process.env.E2E_QA_MOBILE_URL
const smtpInbox = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025'
const password = 'Qa!RoomLink-Test123'
const answers = { schedule: 3, cleanliness: 4, noise: 2, pets: 4, smoking: 1, visits: 3, genderPref: 3 }
const icon = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

async function call(path, { token, method = 'GET', body, want = 200 } = {}) {
  const options = { method, headers: {}, signal: AbortSignal.timeout(10_000) }
  if (token) options.headers.Authorization = `Bearer ${token}`
  if (body instanceof FormData) options.body = body
  else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }
  const res = await fetch(api.href.replace(/\/$/, '') + path, options)
  const data = await res.json().catch(() => undefined)
  expect(res.status, `${method} ${path} (${data?.code ?? data?.error ?? 'sin código'})`).toBe(want)
  expect(data, `${method} ${path} debe responder JSON`).toBeDefined()
  return data
}

function loopback(url) {
  return ['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
}

test.beforeEach(({ baseURL }) => {
  // E2E_ALLOW_REMOTE=1 habilita correr contra un entorno remoto (p.ej. prod)
  // para pruebas que solo usan la API HTTP; por defecto se exige loopback.
  if (process.env.E2E_ALLOW_REMOTE === '1') return
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
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
}

// La navegación vive tras un drawer lateral que queda `inert` mientras está
// cerrado; hay que abrirlo con el botón «Abrir menú» antes de pulsar un enlace.
async function abrirMenu(target) {
  const toggle = target.getByRole('button', { name: 'Abrir menú' })
  if (await toggle.isVisible().catch(() => false)) await toggle.click()
}

async function irA(target, name) {
  await abrirMenu(target)
  await target.getByRole('link', { name, exact: true }).click()
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
    await hostPage.goto('/perfil/arrendador')
    await hostPage.getByRole('checkbox', { name: /términos de responsabilidad/ }).check()
    await hostPage.getByRole('button', { name: 'Convertirme en arrendador' }).click()
    await expect(hostPage.getByText('Tu cuenta de arrendador está lista.')).toBeVisible()
    await hostPage.reload()
    await expect(hostPage.getByText('Tu cuenta de arrendador está lista.')).toBeVisible()
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
    page.route('https://*.basemaps.cartocdn.com/**', (route) => route.fulfill(tile)),
    hostPage.route('https://*.basemaps.cartocdn.com/**', (route) => route.fulfill(tile)),
  ])
  try {
    await Promise.all([login(page, seeker), login(hostPage, host)])
    await call(`/profiles/${host.id}/verification/request`, { method: 'POST', token: host.token })
    await hostPage.goto('/perfil/arrendador')
    await hostPage.getByRole('checkbox', { name: /términos de responsabilidad/ }).check()
    await hostPage.getByRole('button', { name: 'Convertirme en arrendador' }).click()
    await irA(hostPage, 'Gestionar habitaciones')
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

    await irA(page, 'Todas las habitaciones')
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
    const applicant = hostPage.getByRole('article').filter({
      has: hostPage.getByRole('heading', { name: 'RoomLink QA buscador-web', exact: true }),
    })
    await applicant.getByText('Perfil del postulante', { exact: true }).click()
    await expect(applicant.getByRole('link', { name: 'Ver perfil y compatibilidad' }))
      .toHaveAttribute('href', `/perfil/candidato/${seeker.id}`)
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

test('Explorar de Omar refleja el estado de anuncios de Avril y conserva la postulación', async ({ page, browser, baseURL }) => {
  const seeker = await account('explorar-web')
  const host = await account('anuncios-web')
  await call(`/profiles/${host.id}/verification/request`, { method: 'POST', token: host.token })
  await call('/auth/become-host', { method: 'POST', token: host.token, body: { acceptedTerms: true } })
  const room = await listing(host.token)
  const hostContext = await browser.newContext({ baseURL })

  try {
    const hostPage = await hostContext.newPage()
    await Promise.all([login(page, seeker), login(hostPage, host)])
    await irA(hostPage, 'Mis anuncios')
    const ad = hostPage.getByRole('article').filter({ has: hostPage.getByRole('heading', { name: room.title, exact: true }) })
    await ad.getByRole('button', { name: 'Ver', exact: true }).click()
    await expect(hostPage).toHaveURL(new URL(`/anuncios/${room.id}`, baseURL).href)
    await expect(hostPage.getByRole('heading', { name: room.title, exact: true })).toBeVisible()
    await hostPage.getByRole('button', { name: 'Volver a mis anuncios' }).click()

    await irA(page, 'Encuentra tu habitación')
    await expect(page.getByRole('heading', { name: 'Encuentra tu habitación' })).toBeVisible()
    const search = page.getByRole('searchbox', { name: 'Buscar habitaciones' })
    const rent = page.getByLabel('Renta', { exact: true })
    const roomButton = page.getByRole('button', { name: `Ver habitación ${room.title}`, exact: true })
    await rent.selectOption('3000')
    const filteredFeed = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname === '/api/v1/rooms/feed'
        && url.searchParams.get('q') === room.title
        && url.searchParams.get('maxRent') === '3000'
    })
    await search.fill(room.title)
    expect((await filteredFeed).ok()).toBe(true)
    await expect(page.getByRole('heading', { name: 'No encontramos habitaciones' })).toBeVisible()
    await rent.selectOption('5000')
    await roomButton.click()

    await expect(page).toHaveURL(new URL(`/habitacion/${room.id}`, baseURL).href)
    await expect(page.getByRole('heading', { name: room.title, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reglas de la casa' })).toBeVisible()
    const cost = page.locator('dt').filter({ hasText: /^Sin cargos adicionales/ })
    await expect(cost).toBeVisible()
    await expect(cost.locator('..').locator('dd')).toHaveText('Incluido')
    const message = 'Me gustaría conocer la habitación.'
    await page.getByLabel('Mensaje para el anfitrión', { exact: true }).fill(message)
    await page.getByRole('button', { name: 'Postularme', exact: true }).click()
    const sent = page.getByRole('status').filter({ hasText: 'Postulación enviada · en revisión' })
    await expect(sent).toBeVisible()
    await page.reload()
    await expect(sent).toBeVisible()
    await expect(page.getByRole('button', { name: 'Postularme', exact: true })).toHaveCount(0)
    expect(await call('/applications/me', { token: seeker.token })).toEqual([
      expect.objectContaining({ listingId: room.id, message, status: 'pending' }),
    ])

    const onDialog = (dialog) => dialog.accept()
    hostPage.on('dialog', onDialog)
    try {
      await ad.getByRole('button', { name: 'Pausar', exact: true }).click()
      await expect(ad.getByRole('button', { name: 'Activar', exact: true })).toBeVisible()
      const closedWhilePaused = await call(`/rooms/${room.id}/close`, { method: 'PATCH', token: host.token, want: 409 })
      expect(closedWhilePaused.error).toMatch(/publicación activa/)
      await irA(page, 'Encuentra tu habitación')
      const [pausedFeed] = await Promise.all([
        page.waitForResponse((response) => {
          const url = new URL(response.url())
          return url.pathname === '/api/v1/rooms/feed' && url.searchParams.get('q') === room.title
        }),
        search.fill(room.title),
      ])
      expect(pausedFeed.ok()).toBe(true)
      expect((await pausedFeed.json()).items).toEqual([])
      await expect(page.getByRole('heading', { name: 'No encontramos habitaciones' })).toBeVisible()
      await expect(roomButton).toHaveCount(0)

      await ad.getByRole('button', { name: 'Activar', exact: true }).click()
      await expect(ad.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible()
      await page.reload()
      await search.fill(room.title)
      await roomButton.click()
      await expect(sent).toBeVisible()
      await expect(page.getByRole('button', { name: 'Postularme', exact: true })).toHaveCount(0)
    } finally {
      hostPage.off('dialog', onDialog)
    }
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
  await irA(page, 'Para ti')
  await expect(page.getByRole('link', { name: 'Hacer mi test' })).toBeVisible()
  await expect(page.locator('.compatibility-badge')).toHaveCount(0)
  await page.getByRole('link', { name: 'Hacer mi test' }).click()
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  const options = page.getByRole('group', { name: 'Selecciona una respuesta' }).locator('label')
  for (let index = 0; index < 7; index++) {
    await options.first().click()
    await page.getByRole('button', { name: index === 6 ? 'Ver resultados' : 'Siguiente' }).click()
  }
  const dimensions = page.getByRole('progressbar')
  const schedules = page.getByRole('progressbar', { name: /^Horarios:/ })
  await expect(dimensions).toHaveCount(7)
  await expect(schedules).toHaveAttribute('aria-valuenow', '0')
  await page.getByRole('button', { name: 'Guardar mis respuestas' }).click()
  await expect(page.getByText('Tus respuestas se guardaron correctamente.')).toBeVisible()
  await page.reload()
  await expect(dimensions).toHaveCount(7)
  await page.getByRole('button', { name: 'Editar respuestas' }).click()
  await options.last().click()
  await page.getByRole('button', { name: 'Finalizar y guardar test' }).click()
  await expect(schedules).toHaveAttribute('aria-valuenow', '100')
  await expect(page.getByText('Tus respuestas se guardaron correctamente.')).toBeVisible()
  await irA(page, 'Para ti')
  const cards = page.locator('.candidate-card')
  const featured = cards.filter({ hasText: 'RoomLink QA ' + featuredTag })
  await expect(featured.getByRole('heading')).toHaveText(new RegExp(`^RoomLink QA ${featuredTag}, [0-9]+$`))
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
  await featured.getByRole('button', { name: /^Vista rápida de/ }).click()
  const preview = page.getByRole('dialog', { name: 'Vista rápida' })
  await expect(preview).toContainText('RoomLink QA ' + featuredTag)
  await preview.getByRole('button', { name: 'Ver perfil completo' }).click()
  await expect(page.getByRole('table', { name: 'Comparación de hábitos' })).toBeVisible()
  await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Guardar perfil', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await irA(page, 'Para ti')
  await page.getByRole('button', { name: 'Guardados', exact: true }).click()
  await expect(page.getByRole('link', { name: 'RoomLink QA ' + featuredTag, exact: true })).toBeVisible()
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

test('Conexiones de Avril acepta una solicitud y Mis roomies abre el chat persistente', async ({ page, browser, baseURL }) => {
  const sender = await account('chat-origen')
  const receiver = await account('chat-receptor')
  const other = await account('chat-ajeno', false)
  const connection = await call('/connections', {
    method: 'POST', token: sender.token, body: { addresseeId: receiver.id, introMessage: 'Hola' }, want: 201,
  })
  await call('/connections', {
    method: 'POST', token: receiver.token, body: { addresseeId: sender.id }, want: 409,
  })
  const pendingChat = await call('/messages/rooms', {
    method: 'POST', token: sender.token, body: { connectionId: connection.id }, want: 403,
  })
  expect(pendingChat.code).toBe('CHAT_ORIGIN_NOT_AUTHORIZED')
  const context = await browser.newContext({ baseURL })
  try {
    const incoming = await context.newPage()
    await Promise.all([login(page, sender), login(incoming, receiver)])
    await irA(page, 'Conexiones')
    const outgoing = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'RoomLink QA chat-receptor' }) })
    await expect(outgoing.getByText('Solicitud enviada', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Mis roomies', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Aún no tienes roomies' })).toBeVisible()

    await irA(incoming, 'Conexiones')
    await incoming.getByRole('button', { name: /^Recibidas/ }).click()
    const request = incoming.getByRole('article').filter({ has: incoming.getByRole('heading', { name: 'RoomLink QA chat-origen' }) })
    await expect(request.getByText('Solicitud recibida', { exact: true })).toBeVisible()
    await request.getByRole('button', { name: 'Aceptar', exact: true }).click()
    await expect(incoming.getByRole('heading', { name: 'No tienes solicitudes recibidas' })).toBeVisible()
    await incoming.getByRole('button', { name: /^Aceptadas/ }).click()
    await expect(request.getByText('Conexión aceptada', { exact: true })).toBeVisible()
    expect(await call('/connections?direction=outgoing', { token: sender.token })).toEqual([
      expect.objectContaining({ id: connection.id, status: 'accepted' }),
    ])

    await page.reload()
    const roomie = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'RoomLink QA chat-receptor' }) })
    await roomie.getByRole('button', { name: 'Ir al chat' }).click()
    await expect(page).toHaveURL(/\/mensajes\/[^/]+$/)
    const roomId = new URL(page.url()).pathname.split('/').at(-1)
    await page.getByRole('button', { name: 'Detalles', exact: true }).click()
    await expect(page.getByText('Conexión aceptada', { exact: true })).toBeVisible()
    const message = 'Conversación desde una conexión'
    await page.getByRole('textbox', { name: 'Mensaje' }).fill(message)
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByText(message, { exact: true }).last()).toBeVisible()
    await call(`/messages/rooms/${roomId}/messages`, { token: other.token, want: 403 })
    await incoming.goto(`/mensajes/${roomId}`)
    await expect(incoming.getByText(message, { exact: true }).last()).toBeVisible()
    await incoming.reload()
    await expect(incoming.getByText(message, { exact: true }).last()).toBeVisible()
  } finally {
    await context.close()
  }
})

test('HU-08 conserva el rechazo y mantiene bloqueado el chat para ambos participantes', async ({ page, browser, baseURL }) => {
  const sender = await account('rechazo-origen')
  const recipient = await account('rechazo-destino')
  const connection = await call('/connections', {
    method: 'POST', token: sender.token, body: { addresseeId: recipient.id }, want: 201,
  })
  const context = await browser.newContext({ baseURL })
  try {
    const recipientPage = await context.newPage()
    await Promise.all([login(page, sender), login(recipientPage, recipient)])
    await irA(recipientPage, 'Conexiones')
    const request = recipientPage.getByRole('article').filter({
      has: recipientPage.getByRole('heading', { name: 'RoomLink QA rechazo-origen', exact: true }),
    })
    await request.getByRole('button', { name: 'Rechazar', exact: true }).click()
    const empty = { name: 'Todavía no tienes conexiones', exact: true }
    await expect(recipientPage.getByRole('heading', empty)).toBeVisible()
    await recipientPage.reload()
    await expect(recipientPage.getByRole('heading', empty)).toBeVisible()

    await irA(page, 'Conexiones')
    await expect(page.getByRole('heading', empty)).toBeVisible()
    expect(await call('/connections?direction=incoming', { token: recipient.token })).toEqual([
      expect.objectContaining({ id: connection.id, status: 'rejected' }),
    ])
    expect(await call('/connections?direction=outgoing', { token: sender.token })).toEqual([
      expect.objectContaining({ id: connection.id, status: 'rejected' }),
    ])
    for (const token of [sender.token, recipient.token]) {
      const chat = await call('/messages/rooms', {
        method: 'POST', token, body: { connectionId: connection.id }, want: 403,
      })
      expect(chat.code).toBe('CHAT_ORIGIN_NOT_AUTHORIZED')
    }
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

  // Una solicitud pendiente no concede acceso al contacto.
  const connection = await call(`/compatibility/${connected.id}/connections`, {
    method: 'POST', token: connected.token, body: { candidateId: owner.id, introMessage: 'Hola' }, want: 201,
  })
  const pendingView = await call(`/profiles/${owner.id}`, { token: connected.token })
  expect(pendingView.phone).toBeNull()
  expect(pendingView.instagram).toBeNull()
  expect(pendingView.email ?? null).toBeNull()
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
  await page.getByRole('group', { name: 'Secciones de preferencias' }).getByRole('button', { name: 'Privacidad', exact: true }).click()
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
    const card = adminPage.locator('section.room-panel').filter({
      has: adminPage.getByRole('heading', { name: ownerName, exact: true }),
    })
    for (let pageNumber = 1; pageNumber <= 12; pageNumber++) {
      await expect(adminPage.getByText('Cargando solicitudes.', { exact: true })).toHaveCount(0)
      if (await card.count()) break
      const next = adminPage.getByRole('button', { name: 'Siguiente', exact: true })
      if (pageNumber === 12 || !(await next.count()) || !(await next.isEnabled())) break
      const [response] = await Promise.all([
        adminPage.waitForResponse((result) => {
          const url = new URL(result.url())
          return url.pathname === '/api/v1/profiles/verification/pending'
            && url.searchParams.get('page') === String(pageNumber + 1)
        }),
        next.click(),
      ])
      expect(response.ok()).toBe(true)
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

test('M12 registra las dos firmas, crea una nueva versión y niega el acceso a terceros', async ({ page, browser, baseURL }) => {
  const host = await account('acuerdo-host')
  const roomie = await account('acuerdo-roomie')
  const stranger = await account('acuerdo-ajeno')

  // El host se vuelve arrendador y publica una habitación.
  await call(`/profiles/${host.id}/verification/request`, { method: 'POST', token: host.token })
  await call('/auth/become-host', { method: 'POST', token: host.token, body: { acceptedTerms: true } })
  const room = await listing(host.token)

  // El roomie se postula y el host lo acepta (requisito para generar el acuerdo).
  const application = await call('/applications', { method: 'POST', token: roomie.token, body: { listingId: room.id }, want: 201 })
  await call(`/applications/${application.id}/decide`, { method: 'PATCH', token: host.token, body: { decision: 'accept' } })

  // El host genera el acuerdo v1 (snapshot de las reglas del anuncio, sin firmas).
  const details = {
    title: 'Acuerdo con reglas personalizadas',
    startDate: '2030-02-01',
    rules: [{ category: 'Pagos', title: 'Fecha de pago', description: 'Pagar el primer día del mes.' }],
  }
  const agreement = await call('/agreements', {
    method: 'POST', token: host.token,
    body: { listingId: room.id, hostId: host.id, roomieId: roomie.id, details }, want: 201,
  })
  expect(agreement.version).toBe(1)
  expect(agreement.rulesSnapshot.details).toEqual(details)
  expect(agreement.fullyAccepted).toBe(false)
  const reviewPath = `/acuerdos/revisar/${agreement.id}`

  // Firma 1 — el host acepta desde la UI.
  await login(page, host)
  await page.goto(reviewPath)
  await page.getByRole('checkbox', { name: /He leído y acepto/ }).check()
  await page.getByRole('button', { name: 'Aceptar versión 1' }).click()
  await expect(page.getByText(/Tu aceptación se registró/)).toBeVisible()
  await expect(page.getByText('1 de 2 aceptaron')).toBeVisible()

  // Firma 2 — el roomie acepta desde otra sesión; el acuerdo queda completo.
  const roomieContext = await browser.newContext({ baseURL })
  try {
    const roomiePage = await roomieContext.newPage()
    await login(roomiePage, roomie)
    await roomiePage.goto(reviewPath)
    await expect(roomiePage.getByRole('heading', { name: details.title, exact: true })).toBeVisible()
    await expect(roomiePage.getByText(details.startDate, { exact: true })).toBeVisible()
    await expect(roomiePage.getByText(details.rules[0].description, { exact: true })).toBeVisible()
    await roomiePage.getByRole('checkbox', { name: /He leído y acepto/ }).check()
    await roomiePage.getByRole('button', { name: 'Aceptar versión 1' }).click()
    await expect(roomiePage.getByText(/Tu aceptación se registró/)).toBeVisible()
    await expect(roomiePage.getByText('Todos los integrantes aceptaron esta versión.')).toBeVisible()
  } finally {
    await roomieContext.close()
  }

  // Persistencia: la API refleja dos firmas y el host lo ve al volver a entrar.
  const signed = await call(`/agreements/${agreement.id}`, { token: host.token })
  expect(signed.acceptances.filter((a) => a.acceptedAt).length).toBe(2)
  expect(signed.fullyAccepted).toBe(true)
  await page.reload()
  await expect(page.getByText('2 de 2 aceptaron')).toBeVisible()

  // Nueva versión (host-only): reinicia las firmas y supera a la anterior.
  const v2 = await call(`/agreements/${agreement.id}/versions`, { method: 'POST', token: host.token, want: 201 })
  expect(v2.version).toBe(2)
  expect(v2.rulesSnapshot.details).toEqual(details)
  expect(v2.supersedesAgreementId).toBe(agreement.id)
  expect(v2.fullyAccepted).toBe(false)
  expect(v2.acceptances.filter((a) => a.acceptedAt).length).toBe(0)

  // Acceso de terceros: un no participante no puede leer el acuerdo ni versionarlo.
  await call(`/agreements/${agreement.id}`, { token: stranger.token, want: 403 })
  await call(`/agreements/${v2.id}/versions`, { method: 'POST', token: stranger.token, want: 403 })
})

test('M15 valida métricas del dashboard por rango, rol y estado vacío', async ({ page }) => {
  const admin = await account('admin', false)
  await grantQaAdmin(admin.id)
  const today = new Date().toISOString().slice(0, 10)

  // Privacidad por rol: un no-admin no puede leer la analítica.
  const intruder = await account('analitica-intruso', false)
  await call(`/admin/analytics?start=${today}&end=${today}`, { token: intruder.token, want: 403 })

  // Estado vacío: un rango histórico sin datos devuelve ceros y tasa nula.
  const empty = await call('/admin/analytics?start=2000-01-01&end=2000-01-31', { token: admin.token })
  expect(empty.kpis.usersRegistered).toBe(0)
  expect(empty.kpis.connectionsSent).toBe(0)
  expect(empty.kpis.connectionAcceptanceRate).toBeNull()
  expect(empty.monthlyUsers.every((m) => m.total === 0)).toBe(true)

  // Validación de rango: fechas invertidas y rango mayor a 12 meses → 400.
  await call('/admin/analytics?start=2024-06-01&end=2024-05-01', { token: admin.token, want: 400 })
  await call('/admin/analytics?start=2024-01-01&end=2025-06-01', { token: admin.token, want: 400 })

  // Métricas con datos conocidos: delta sobre el día de hoy (robusto en la DB QA compartida).
  const before = await call(`/admin/analytics?start=${today}&end=${today}`, { token: admin.token })
  const u1 = await account('m15-u1')
  const u2 = await account('m15-u2')
  const u3 = await account('m15-u3')
  const c1 = await call(`/compatibility/${u1.id}/connections`, { method: 'POST', token: u1.token, body: { candidateId: u2.id, introMessage: null }, want: 201 })
  await call(`/compatibility/${u1.id}/connections`, { method: 'POST', token: u1.token, body: { candidateId: u3.id, introMessage: null }, want: 201 })
  await call(`/connections/${c1.id}`, { method: 'PATCH', token: u2.token, body: { decision: 'accept' } })
  const after = await call(`/admin/analytics?start=${today}&end=${today}`, { token: admin.token })

  expect(after.kpis.usersRegistered - before.kpis.usersRegistered, 'tres usuarios nuevos').toBe(3)
  expect(after.kpis.connectionsSent - before.kpis.connectionsSent, 'dos conexiones enviadas').toBe(2)
  expect(after.kpis.connectionsAccepted - before.kpis.connectionsAccepted, 'una conexión aceptada').toBe(1)
  expect(after.period).toEqual({ start: today, end: today })
  // La serie mensual del mes en curso sube exactamente en los tres usuarios.
  const month = today.slice(0, 7)
  const usersBeforeMonth = before.monthlyUsers.find((m) => m.month === month)?.total ?? 0
  const usersAfterMonth = after.monthlyUsers.find((m) => m.month === month)?.total ?? 0
  expect(usersAfterMonth - usersBeforeMonth).toBe(3)

  // Vite consume la MISMA API que Expo: el dashboard admin renderiza los KPIs.
  await login(page, admin)
  await page.goto('/admin/dashboard')
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await expect(page.getByLabel('Indicadores clave')).toBeVisible()
  const metrics = page.getByLabel('Indicadores clave')
  await expect(metrics.getByText('Ocupación estimada', { exact: true })).toBeVisible()
  await expect(metrics.getByText('Afinidad promedio de postulaciones', { exact: true })).toBeVisible()
})

test('Bitácora de Omar protege el acceso y exporta solo los registros filtrados', async ({ page }) => {
  const viewer = await account('bitacora-usuario', false)
  const admin = await account('admin', false)
  await grantQaAdmin(admin.id)
  await call('/admin/activity-log', { token: viewer.token, want: 403 })
  await login(page, viewer)
  await page.goto('/admin/bitacora')
  await expect(page).toHaveURL(/\/explorar$/)
  await expect(page.getByRole('link', { name: 'Bitácora', exact: true })).toHaveCount(0)
  await abrirMenu(page)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await login(page, admin)
  await irA(page, 'Bitácora')
  await expect(page.getByRole('heading', { name: 'Bitácora', exact: true })).toBeVisible()
  await page.getByLabel('Evento').selectOption('UserRegisteredEvent')
  await page.getByLabel('Usuario (ID)', { exact: true }).fill(viewer.id)
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page.getByText('1 registro', { exact: true })).toBeVisible()
  const entry = page.getByRole('listitem').filter({ hasText: viewer.id })
  await expect(entry.getByText('Registro de usuario', { exact: true })).toBeVisible()
  await entry.getByRole('button', { name: 'Ver detalle' }).click()
  await expect(entry.getByText(viewer.email, { exact: false })).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar página (CSV)' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^bitacora-roomlink-.*\.csv$/)
  const csv = await readFile(await download.path(), 'utf8')
  expect(csv).toContain(viewer.id)
  expect(csv).toContain('UserRegisteredEvent')
  expect(csv).not.toContain(admin.id)
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
  const search = page.getByRole('textbox', { name: 'Buscar habitaciones', exact: true })
  const card = page.getByTestId(`habitacion-${room.id}`)
  await search.fill(room.title)
  await card.getByRole('button', { name: 'Postularme', exact: true }).click()
  await expect(card.getByText(/Postulación enviada/)).toBeVisible()
  await page.reload()
  await search.fill(room.title)
  await expect(card.getByText(/Postulación enviada/)).toBeVisible()
  await expect(card.getByRole('button', { name: 'Postularme', exact: true })).toHaveCount(0)
  expect(await call(`/applications/listing/${room.id}`, { token: host.token })).toEqual([
    expect.objectContaining({ applicantId: seeker.id, listingId: room.id }),
  ])
})

test('Expo abre el chat de un roomie desde Solicitudes y conserva el historial al recargar', async ({ page }) => {
  test.skip(!mobileWeb, 'Requiere el cliente Expo de QA.')
  expect(loopback(mobileWeb)).toBe(true)
  const sender = await account('roomie-expo-origen')
  const receiver = await account('roomie-expo-receptor')
  const connection = await call('/connections', {
    method: 'POST', token: sender.token, body: { addresseeId: receiver.id }, want: 201,
  })
  await call(`/connections/${connection.id}`, {
    method: 'PATCH', token: receiver.token, body: { decision: 'accept' },
  })
  const chat = await call('/messages/rooms', {
    method: 'POST', token: receiver.token, body: { connectionId: connection.id }, want: 201,
  })
  const message = 'Mensaje de una conexión aceptada en Expo'
  await call(`/messages/rooms/${chat.id}/messages`, {
    method: 'POST', token: sender.token, body: { body: message }, want: 201,
  })

  await loginMobile(page, receiver)
  await page.goto(new URL('/solicitudes', mobileWeb).href)
  await expect(page.getByText('Mis conexiones', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Mis roomies', exact: true }).click()
  await expect(page).toHaveURL(new URL('/mis-roomies', mobileWeb).href)
  await expect(page.getByText('RoomLink QA roomie-expo-origen', { exact: true }).filter({ visible: true })).toBeVisible()
  await page.getByText('Ir al chat', { exact: true }).filter({ visible: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/chats' && url.searchParams.get('roomId') === chat.id)
  await expect(page.getByText(message, { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText(message, { exact: true })).toBeVisible()
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
