
export default function EstadoVacio({ tipo = "all" }) {
  const mensajes = {
    all: {
      icono: "users",
      titulo: "Todavía no tienes conexiones",
      descripcion:
        "Cuando conectes con otros usuarios de RoomLink, aparecerán aquí.",
    },
    incoming: {
      icono: "inbox",
      titulo: "No tienes solicitudes recibidas",
      descripcion:
        "Cuando alguien quiera conectar contigo, verás su solicitud aquí.",
    },
    outgoing: {
      icono: "send",
      titulo: "No has enviado solicitudes",
      descripcion:
        "Explora perfiles y envía solicitudes para comenzar a conectar.",
    },
    accepted: {
      icono: "user-check",
      titulo: "Aún no tienes conexiones aceptadas",
      descripcion:
        "Las personas que acepten tus solicitudes aparecerán aquí.",
    },
  };

  const contenido = mensajes[tipo] ?? mensajes.all;

  return (
    <section className="conexiones-empty">
      <div className="conexiones-empty-icon">
        <span aria-hidden="true">
          {tipo === "incoming"
            ? "↓"
            : tipo === "outgoing"
              ? "↑"
              : tipo === "accepted"
                ? "♡"
                : "♧"}
        </span>
      </div>

      <h3>{contenido.titulo}</h3>
      <p>{contenido.descripcion}</p>
    </section>
  );
}
