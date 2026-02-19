import { createValidationError } from "./errors.js";

const ABSOLUTE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeDateInput(input: string, now: Date = new Date()): string {
  const normalizedInput = input.trim();
  const lower = normalizedInput.toLowerCase();

  if (lower === "yesterday") {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return toIsoLocalDate(date);
  }

  const match = ABSOLUTE_DATE_PATTERN.exec(normalizedInput);
  if (!match) {
    throw createValidationError(
      `Invalid date "${input}". Expected YYYY-MM-DD or relative value "yesterday".`
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw createValidationError(
      `Invalid date "${input}". Use a real calendar date in YYYY-MM-DD format.`
    );
  }

  return normalizedInput;
}

function toIsoLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
