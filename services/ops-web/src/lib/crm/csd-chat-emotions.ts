export const CSD_CHAT_EMOTIONS = [
  { id: 'like', emoji: '👍', label: 'Thích' },
  { id: 'love', emoji: '❤️', label: 'Yêu' },
  { id: 'haha', emoji: '😆', label: 'Haha' },
  { id: 'wow', emoji: '😮', label: 'Wow' },
  { id: 'sad', emoji: '😢', label: 'Buồn' },
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

const EMOTION_SET = new Set<string>(CSD_CHAT_EMOTIONS.map((item) => item.emoji));

export function isCsdChatEmotionMessage(text: string | null | undefined): boolean {
  return EMOTION_SET.has(String(text ?? '').trim());
}
