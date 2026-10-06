// Contato contínuo: o projétil não pode atravessar uma nave entre dois passos.
// Devolve o primeiro instante do impacto (0..1), ou Infinity se não toca.
export function sweepSphere(ax, ay, az, bx, by, bz, target, radius) {
  const x = ax - target.x, y = ay - target.y, z = az - (target.z || 0);
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const c = x * x + y * y + z * z - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-12) return Infinity;
  const b = x * dx + y * dy + z * dz;
  const d = b * b - a * c;
  if (d < 0) return Infinity;
  const t = (-b - Math.sqrt(d)) / a;
  return t >= 0 && t <= 1 ? t : Infinity;
}

// Assistência curta: é preciso pilotar para alinhar a coluna de tiro.
// A antecipação limitada compensa o tempo de voo, sem tiros teleguiados.
export function aimTarget(world, tolerance, speed) {
  const p = world.player;
  let target = null, best = Infinity;
  const consider = e => {
    if (!e || e.dead || e.z <= 40 || e.z > 1900) return;
    const distance = Math.hypot(e.x - p.x, e.y - p.y);
    if (distance > e.r * .8 + tolerance) return;
    const score = distance + e.z * .035;
    if (score < best) { target = e; best = score; }
  };
  for (const e of world.enemies) consider(e);
  if (world.boss?.state === 'fight') consider(world.boss);
  if (!target) return { x: p.x, y: p.y, z: 700, locked: false };
  const time = Math.min(.65, target.z / speed);
  const lead = v => Math.max(-36, Math.min(36, (v || 0) * time));
  return { x: target.x + lead(target.motionX), y: target.y + lead(target.motionY),
    z: target.z, locked: true, r: target.r };
}
