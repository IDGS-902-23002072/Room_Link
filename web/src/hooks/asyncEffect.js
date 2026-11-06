export function asyncEffect(run) {
  let active = true
  void run(() => active)

  return () => {
    active = false
  }
}
