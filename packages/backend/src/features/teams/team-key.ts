/**
 * Derive a team key from a name: its first three non-space characters, uppercased.
 * @param name team or workspace display name
 * @returns team key
 */
export function teamKeyFromName(name: string) {
  return name.split(" ").join("").slice(0, 3).toUpperCase();
}
