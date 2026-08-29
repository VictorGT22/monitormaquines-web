// Rangs horaris dels torns (minuts des de mitjanit, hora de Madrid) —
// mateixos límits que ja fa servir GraficCronologia.js per repartir
// segments per torn. Centralitzat aquí perquè les taules de Paradas i
// Alarmes (que no reben el torn ja calculat pel backend, a diferència
// d'Alarmes) puguin derivar-lo del timestamp sense duplicar els límits.
export const RANGS_TORN = {
  Matí: [[360, 840]],
  Tarda: [[840, 1320]],
  Nit: [[0, 360], [1320, 1440]],
};

const FORMATADOR_MADRID = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function calcularTorn_(iso) {
  if (!iso) return null;
  const parts = Object.fromEntries(
    FORMATADOR_MADRID.formatToParts(new Date(iso)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)])
  );
  const min = parts.hour * 60 + parts.minute;
  for (const [torn, rangs] of Object.entries(RANGS_TORN)) {
    if (rangs.some(([i, f]) => min >= i && min < f)) return torn;
  }
  return 'Nit';
}
