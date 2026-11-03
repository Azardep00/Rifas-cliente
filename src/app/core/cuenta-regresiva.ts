/** 872000 -> "14:32"; 3725000 -> "1:02:05"; <= 0 -> "00:00". Redondea hacia arriba: no marca 00:00 antes de tiempo. */
export function formatearCuentaRegresiva(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dos = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}
