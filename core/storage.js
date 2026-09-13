// Persistência namespaced por jogo. Nunca lança: localStorage pode estar
// bloqueado (aba privada, cookies de terceiros, modo quiosque).
const PREFIX = 'ia-games';

export function createStore(namespace) {
  const key = name => `${PREFIX}:${namespace}:${name}`;
  return {
    get(name, fallback = null) {
      try {
        const raw = localStorage.getItem(key(name));
        return raw === null ? fallback : JSON.parse(raw);
      } catch (_) { return fallback; }
    },
    set(name, value) {
      try { localStorage.setItem(key(name), JSON.stringify(value)); return true; }
      catch (_) { return false; }
    },
    remove(name) {
      try { localStorage.removeItem(key(name)); } catch (_) {}
    }
  };
}
