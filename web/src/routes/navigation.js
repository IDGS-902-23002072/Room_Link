export function push(navigate, path) {
  navigate(path, { replace: false })
}

export function goBack(navigate, fallback = '/explorar') {
  if (window.history.state?.idx > 0) {
    navigate(-1)
    return
  }
  navigate(fallback, { replace: true })
}
