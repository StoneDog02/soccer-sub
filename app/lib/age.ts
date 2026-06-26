/**
 * Age in full years at a reference date (default: today).
 * Date-only strings `YYYY-MM-DD` use the local calendar (avoids UTC off-by-one vs DB dates).
 */
export function ageFromDateOfBirth(
  isoDate: string | null | undefined,
  ref: Date = new Date(),
): number | null {
  if (isoDate == null) return null;
  const s = String(isoDate).trim();
  if (!s) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  let born: Date;
  if (dateOnly) {
    const y = Number(dateOnly[1]);
    const mo = Number(dateOnly[2]) - 1;
    const d = Number(dateOnly[3]);
    born = new Date(y, mo, d);
    if (
      born.getFullYear() !== y ||
      born.getMonth() !== mo ||
      born.getDate() !== d
    ) {
      return null;
    }
  } else {
    born = new Date(s);
    if (Number.isNaN(born.getTime())) return null;
  }

  let age = ref.getFullYear() - born.getFullYear();
  const m = ref.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < born.getDate())) age--;
  return age;
}
