import { customAlphabet } from "nanoid";

const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const nanoid = customAlphabet(BASE36, 6);

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  return `${prefix}_${timestamp}${nanoid()}`;
}

export function generateEntryId(): string {
  return generateId("ent");
}

export function generateProjectId(): string {
  return generateId("prj");
}

export function isEntryId(value: string): boolean {
  return value.startsWith("ent_");
}

export function isProjectId(value: string): boolean {
  return value.startsWith("prj_");
}
