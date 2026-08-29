export function separarHoresMinuts_(minuts) {
  const total = Math.max(0, Math.round(Number(minuts) || 0));
  return {
    hores: Math.floor(total / 60),
    minuts: total % 60,
  };
}
