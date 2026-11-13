// friend search for the draft editor. pure, so the same rule runs on the server and in tests.

const fold = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const words = (v: string) => fold(v).split(/[^a-z0-9]+/).filter(Boolean);

/** every typed word starts some word of the name or an interest: "al" finds alex, "kim a" finds alex kim */
export function matchesFriend(person: { name: string; interests?: string[] | null }, query: string): boolean {
  const want = words(query);
  if (want.length === 0) return true;
  const have = [...words(person.name), ...(person.interests ?? []).flatMap(words)];
  return want.every((w) => have.some((h) => h.startsWith(w)));
}
