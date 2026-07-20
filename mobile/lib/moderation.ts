// Client-side objectionable-content filter, run when a listing is created or
// edited. This is a first-pass net at the point of creation; user reports and
// admin review (see app/admin.tsx) are the backstop. Kept deliberately to clear
// profanity and slurs, matched on word boundaries so ordinary words that merely
// contain these letters (e.g. "class", "assessment") are not flagged.
const OBJECTIONABLE = [
  'fuck', 'fucking', 'shit', 'bitch', 'bastard', 'asshole', 'cunt', 'dick',
  'pussy', 'slut', 'whore', 'nigger', 'nigga', 'faggot', 'retard', 'rape',
  'porn', 'porno', 'nude', 'nudes',
];

// Returns the first objectionable word found across the given texts, or null if
// the content is clean.
export function findObjectionable(...texts: (string | null | undefined)[]): string | null {
  const hay = texts.filter(Boolean).join(' ').toLowerCase();
  for (const word of OBJECTIONABLE) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(hay)) return word;
  }
  return null;
}
