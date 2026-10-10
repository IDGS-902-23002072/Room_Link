# Crea las labels del tablero Kanban descriptas en docs/kanban.md.
# Requisitos: gh CLI autenticado contra el repo.
# Uso: pwsh ./scripts/setup-labels.ps1

$ErrorActionPreference = "Stop"

$labels = @(
  @{ name = "type: feature"; color = "1f883d"; description = "Nueva funcionalidad" },
  @{ name = "type: bug";     color = "d1242f"; description = "Comportamiento incorrecto" },
  @{ name = "type: chore";   color = "6e7781"; description = "Mantenimiento / deuda" },
  @{ name = "type: docs";    color = "0969da"; description = "Solo documentación" },
  @{ name = "type: test";    color = "8250df"; description = "Solo cambios en tests" },
  @{ name = "type: release"; color = "bf8700"; description = "Preparación de release" },
  @{ name = "type: hotfix";  color = "cf222e"; description = "Fix urgente en producción" },

  @{ name = "priority: P0";  color = "b60205"; description = "Crítica, se trabaja ya" },
  @{ name = "priority: P1";  color = "d93f0b"; description = "Alta, próximo ciclo" },
  @{ name = "priority: P2";  color = "fbca04"; description = "Normal" },
  @{ name = "priority: P3";  color = "c5def5"; description = "Baja" },

  @{ name = "status: todo";      color = "ededed"; description = "Lista para tomar" },
  @{ name = "status: blocked";   color = "e99695"; description = "Esperando dependencia externa" },
  @{ name = "status: in-qa";     color = "fef2c0"; description = "En columna QA" },
  @{ name = "status: duplicate"; color = "cfd3d7"; description = "Duplicada de otra tarjeta" },
  @{ name = "status: wontfix";   color = "ffffff"; description = "No se implementará" },

  @{ name = "area: ui";    color = "bfd4f2"; description = "UI / pantallas" },
  @{ name = "area: auth";  color = "d4c5f9"; description = "Autenticación" },
  @{ name = "area: data";  color = "c2e0c6"; description = "Datos / API" },
  @{ name = "area: build"; color = "fad8c7"; description = "Build / packaging" },
  @{ name = "area: ci";    color = "f9d0c4"; description = "CI / pipelines" }
)

foreach ($l in $labels) {
  Write-Host ">> upsert label '$($l.name)'"
  gh label create $l.name --color $l.color --description $l.description --force
}

Write-Host "Listo. Labels sincronizadas."
