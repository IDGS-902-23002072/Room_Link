export const DIMENSIONS = {
  schedule: 'Horarios',
  cleanliness: 'Limpieza',
  noise: 'Ruido',
  pets: 'Mascotas',
  smoking: 'Tabaco',
  visits: 'Visitas',
  genderPref: 'Género',
}

export function formatBudget(minimum, maximum) {
  if (!minimum && !maximum) return 'Presupuesto no indicado'
  const min = minimum ? `$${Number(minimum).toLocaleString('es-MX')}` : 'Sin mínimo'
  const max = maximum ? `$${Number(maximum).toLocaleString('es-MX')}` : 'Sin máximo'
  return `${min} - ${max} MXN`
}
