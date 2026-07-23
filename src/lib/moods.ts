/**
 * Humor do prospect — dá realismo à call. Um CEO apressado, um técnico
 * desconfiado e um ops curioso mudam completamente a dinâmica.
 * O humor é determinístico por cenário (o briefing e a call concordam).
 */
export const MOODS = ['rushed', 'skeptical', 'curious', 'friendly_evasive', 'annoyed'] as const;
export type MoodId = (typeof MOODS)[number];

export const MOOD_EMOJI: Record<MoodId, string> = {
  rushed: '⏱️',
  skeptical: '🤨',
  curious: '🧐',
  friendly_evasive: '🙂',
  annoyed: '😒',
};

/** Chave de i18n do rótulo do humor (traduzido na UI). */
export function moodLabelKey(mood: MoodId): `mood.${MoodId}` {
  return `mood.${mood}`;
}

/** Humor estável por cenário (mesmo humor no briefing e na call). */
export function pickMood(seed: string): MoodId {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return MOODS[h % MOODS.length];
}
