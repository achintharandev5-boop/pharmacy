/** In-memory ENT metadata uses the instruction list; the API stores it as instructions_json.ent. */
export const ENT_PREFIX = 'ENT:v1:';
export type EntSite = 'eye' | 'ear' | 'nose' | 'throat';
export type EntDirection = 'left' | 'right' | 'both';
export type EntSelection = { site: EntSite; direction: EntDirection; unit: string; pluralUnit: string; template: string; customHours?: number; startDay?: string; endDay?: string };
export function defaultEnt(site: EntSite): EntSelection {
  const drops = site === 'eye' || site === 'ear';
  return { site, direction: 'left', unit: drops ? 'drop' : '', pluralUnit: drops ? 'drops' : '', template: drops ? 'Instill {qty} {unit} into {location} {time}.' : 'Apply {qty} {unit} to {location} {time}.' };
}
export function readEnt(instructions: string[]): EntSelection | null {
  const raw = instructions.find(i => i.startsWith(ENT_PREFIX));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw.slice(ENT_PREFIX.length));
    if (!['eye', 'ear', 'nose', 'throat'].includes(value.site) || !['left', 'right', 'both'].includes(value.direction)) return null;
    if (!['unit', 'pluralUnit', 'template'].every(k => typeof value[k] === 'string')) return null;
    return value as EntSelection;
  } catch { return null; }
}
export function entLocation(ent: EntSelection): string {
  return ent.site === 'eye' || ent.site === 'ear' ? ent.direction === 'both' ? `each ${ent.site}` : `the ${ent.direction} ${ent.site}` : `the ${ent.site}`;
}
export function validEntDay(day: string): boolean {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number(day.slice(0, 4)) >= 1 && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}
export function validateEnt(ent: EntSelection): string | null {
  if (ent.customHours !== undefined && (!Number.isInteger(ent.customHours) || ent.customHours < 1 || ent.customHours > 24)) return 'Custom hours must be a whole number from 1 to 24.';
  if ((ent.startDay !== undefined && !validEntDay(ent.startDay)) || (ent.endDay !== undefined && !validEntDay(ent.endDay))) return 'Choose valid ENT start and end dates.';
  if (ent.startDay && ent.endDay && ent.endDay < ent.startDay) return 'End Day must be on or after Start Day.';
  if (!ent.unit.trim() || !ent.pluralUnit.trim()) return 'Enter the ENT administration unit and plural unit.';
  if (!['{qty}', '{unit}', '{location}', '{time}'].every(p => ent.template.includes(p))) return 'ENT template must include {qty}, {unit}, {location} and {time}.';
  return null;
}
export function entInstructions(ent: EntSelection, dosage?: Partial<Record<'morning' | 'lunch' | 'night', { qty: number }>>, frequency?: { code: string; qty: number }): string[] {
  if (validateEnt(ent)) return [];
  const times = { morning: 'in the morning', lunch: 'at lunchtime', night: 'at night' } as const;
  const sentence = (qty: number, time: string) => {
    const values: Record<string, string> = { qty: String(qty), unit: qty === 1 ? ent.unit.trim() : ent.pluralUnit.trim(), location: entLocation(ent), time };
    return ent.template.replace(/\{(qty|unit|location|time)\}/g, (_, key: string) => values[key]);
  };
  const sentences = (Object.keys(times) as (keyof typeof times)[]).flatMap(time => {
    const qty = dosage?.[time]?.qty ?? 0;
    if (!(qty > 0)) return [];
    return [sentence(qty, times[time])];
  });
  if (frequency && frequency.qty > 0) {
    const frequencyTime: Record<string, string> = { '4H': 'every 4 hours', '5H': 'every 5 hours', '6H': 'every 6 hours', '8H': 'every 8 hours', DAILY: 'daily', EVENING: 'in the evening', EOD: 'every other day', SOS: 'as needed' };
    const time = frequency.code === 'CUSTOM' && ent.customHours ? `every ${ent.customHours} ${ent.customHours === 1 ? 'hour' : 'hours'}` : frequencyTime[frequency.code];
    if (time) sentences.push(sentence(frequency.qty, time));
  }
  if (ent.startDay) sentences.push(`Start on ${ent.startDay}.`);
  if (ent.endDay) sentences.push(`End on ${ent.endDay}.`);
  return sentences;
}
