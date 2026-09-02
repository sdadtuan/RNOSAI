export const CSD_CHAT_EMOTIONS = [
  { id: 'like', emoji: '👍', label: 'Thích' },
  { id: 'love', emoji: '❤️', label: 'Yêu' },
  { id: 'haha', emoji: '😆', label: 'Haha' },
  { id: 'wow', emoji: '😲', label: 'Wow' },
  { id: 'sad', emoji: '😭', label: 'Buồn' },
  { id: 'angry', emoji: '😡', label: 'Giận' },
] as const;

export const CSD_CHAT_INSERT_EMOJIS = [
  '😀',
  '😂',
  '😍',
  '🥰',
  '😎',
  '👋',
  '🙏',
  '🎉',
  '🔥',
  '✅',
  '❌',
  '💯',
] as const;

export type ChatReactionRow = { emotion: string; count: number; mine?: boolean };

export function summarizeChatReactions(rows: ChatReactionRow[] | null | undefined): {
  emojis: string[];
  total: number;
  mine: boolean;
  mineEmotion: (typeof CSD_CHAT_EMOTIONS)[number]['id'] | null;
} {
  const list = Array.isArray(rows) ? rows : [];
  const emojis: string[] = [];
  let total = 0;
  let mineEmotion: (typeof CSD_CHAT_EMOTIONS)[number]['id'] | null = null;
  for (const item of CSD_CHAT_EMOTIONS) {
    const row = list.find((entry) => entry.emotion === item.id && entry.count > 0);
    if (!row) continue;
    emojis.push(item.emoji);
    total += row.count;
    if (row.mine) mineEmotion = item.id;
  }
  return { emojis, total, mine: Boolean(mineEmotion), mineEmotion };
}

const EMOTION_SET = new Set<string>(CSD_CHAT_EMOTIONS.map((item) => item.emoji));

export function isCsdChatEmotionMessage(text: string | null | undefined): boolean {
  return EMOTION_SET.has(String(text ?? '').trim());
}
