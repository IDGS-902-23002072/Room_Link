export function formatDate() {
  return ''
}

const dateTime = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' })

export function formatMoment(value) {
  return value ? dateTime.format(new Date(value)) : ''
}
