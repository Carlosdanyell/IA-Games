// Cache de sprites desenhados fora da tela.
//
// Sombra de canvas (`shadowBlur`) é a operação mais cara do 2D. Desenhá-la uma
// vez por sprite e depois só copiar bitmaps derruba drasticamente o custo por
// frame — é o que mantém 60 fps em celular intermediário.
export function createSpriteCache() {
  const cache = new Map();
  return {
    get(key, width, height, draw) {
      const hit = cache.get(key);
      if (hit) return hit;
      const pad = 0;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(width));
      canvas.height = Math.max(1, Math.ceil(height));
      const ctx = canvas.getContext('2d');
      draw(ctx, canvas.width, canvas.height, pad);
      cache.set(key, canvas);
      return canvas;
    },
    clear() { cache.clear(); },
    get size() { return cache.size; }
  };
}
