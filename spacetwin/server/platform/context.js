// The running platform, for code that cannot be handed it directly: the
// backend functions, which import their SDK as a module.

let platform = null;

export function setCurrent(p) {
  platform = p;
}

export function current() {
  if (!platform) throw new Error('VerifiCasa platform not started');
  return platform;
}
