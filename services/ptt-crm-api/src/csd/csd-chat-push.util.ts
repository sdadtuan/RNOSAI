export type ChatPushNotice = {
  title: string;
  body: string;
  conversationId: string;
};

export function chatPushNotice(input: {
  title: string;
  preview: string;
  conversationId: string;
}): ChatPushNotice {
  const preview = input.preview.trim();
  return {
    title: (input.title.trim() || 'PTT').slice(0, 80),
    body: (preview || '(file)').slice(0, 120),
    conversationId: input.conversationId,
  };
}

export function fcmServerKey(): string {
  return String(process.env.PTT_FCM_SERVER_KEY ?? '').trim();
}

export function apnsConfig(): {
  keyId: string;
  teamId: string;
  authKey: string;
  bundleId: string;
  sandbox: boolean;
} | null {
  const keyId = String(process.env.PTT_APNS_KEY_ID ?? '').trim();
  const teamId = String(process.env.PTT_APNS_TEAM_ID ?? '').trim();
  const authKey = String(process.env.PTT_APNS_AUTH_KEY ?? '').trim().replace(/\\n/g, '\n');
  const bundleId = String(process.env.PTT_APNS_BUNDLE_ID ?? 'vn.pttads.ptt').trim();
  if (!keyId || !teamId || !authKey || !bundleId) return null;
  return {
    keyId,
    teamId,
    authKey,
    bundleId,
    sandbox: process.env.PTT_APNS_USE_SANDBOX === '1',
  };
}
