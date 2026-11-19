export function readLocal(userId, name, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(key(userId, name))) ?? fallback
  } catch {
    return fallback
  }
}

export function writeLocal(userId, name, value) {
  try {
    window.localStorage.setItem(key(userId, name), JSON.stringify(value))
  } catch {
    throw new Error('No se pudo guardar la información en este navegador.')
  }
}

function key(userId, name) {
  return `@roomlink/web/${name}:${userId}`
}
