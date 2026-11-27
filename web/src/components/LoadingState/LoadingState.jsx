import './loading-state.css'

export default function LoadingState({ label = 'Cargando contenido…', cards = false, fullscreen = false }) {
  return (
    <div className={`loading-state${fullscreen ? ' loading-state-fullscreen' : ''}`} role="status" aria-live="polite">
      <div className="loading-state-caption"><span className="loading-state-spinner" aria-hidden="true" /><span>{label}</span></div>
      {cards && <div className="loading-state-grid" aria-hidden="true">
        {[0, 1, 2].map((item) => <div className="loading-state-card" key={item}>
          <div className="loading-state-cover" /><div className="loading-state-line" /><div className="loading-state-line loading-state-short" />
        </div>)}
      </div>}
    </div>
  )
}
