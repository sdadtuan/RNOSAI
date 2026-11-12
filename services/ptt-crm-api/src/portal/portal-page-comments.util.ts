import {
  classifyGraphPath,
  extractGraphErrorCode,
  noteGraphError,
  noteGraphHeaders,
  recordGraphCall,
  shouldPauseGraph,
} from './portal-graph-usage';
import { extractContacts } from './portal-care.util';

export type PulledFbPost = {
  post_id: string;
  page_id: string;
  message: string;
  permalink: string;
  picture: string;
  created_time: string;
};

export type PulledComment = {
  comment_id: string;
  page_id: string;
  post_id: string;
  parent_id: string;
  from_name: string;
  from_id: string;
  message: string;
  created_time: string;
  is_hidden: boolean;
  replied: boolean;
  can_hide: boolean;
  can_reply: boolean;
  can_reply_privately: boolean;
};

export type PullCommentsResult = {
  posts: PulledFbPost[];
  comments: PulledComment[];
  hops: number;
  error: string;
  permissionError: string;
  permissionNeeded: string;
};

export type GraphFetcher = (
  url: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; body: Record<string, unknown> | null; headers: Headers }>;

export type MessageAttachment = {
  type: string;
  url: string;
  mime_type: string;
  name: string;
};

const GRAPH = 'https://graph.facebook.com/v21.0';

const COMMENT_FIELDS =
  'id,from,message,created_time,parent,is_hidden,can_hide,can_comment,can_reply_privately,comment_count,comments.limit(8){id,from,message,created_time,parent,is_hidden,can_hide,can_comment,can_reply_privately}';

const POST_FIELDS = `id,message,created_time,permalink_url,full_picture,comments.limit(20).order(reverse_chronological){${COMMENT_FIELDS}}`;

export function parseCommentPermissionError(raw: string): { message: string; permission: string } | null {
  const text = String(raw ?? '');
  if (!text) return null;
  const low = text.toLowerCase();
  const isDenied = /permission|#10|#200|#294|oauth|insufficient|not authorized|not authorised/i.test(text);
  if (!isDenied && !/pages_read_user_content|pages_manage_engagement|pages_read_engagement|pages_manage_metadata|pages_show_list/.test(low)) {
    return null;
  }
  if (/pages_read_user_content/.test(low) || (/user.?content|comments of other|read user/i.test(low) && /permission|#200|#10/.test(low))) {
    return {
      permission: 'pages_read_user_content',
      message:
        'Token của Page chưa có quyền đọc bình luận của người dùng (pages_read_user_content). Xin quyền Nâng cao này trên Meta App, rồi mở lại tab Bình luận.',
    };
  }
  if (/pages_manage_engagement/.test(low) || /manage_engagement|is_hidden|hide comment/.test(low)) {
    return {
      permission: 'pages_manage_engagement',
      message:
        'Token của Page chưa có quyền ẩn hoặc trả lời bình luận (pages_manage_engagement). Xin quyền này trên Meta App trước khi ẩn hay trả lời.',
    };
  }
  if (/pages_read_engagement|pages_show_list|pages_manage_metadata/.test(low) || /posts of this page|read engagement/.test(low)) {
    return {
      permission: 'pages_read_engagement',
      message:
        'Token của Page chưa có quyền đọc bài viết (pages_read_engagement). Xin quyền này trên Meta App, rồi mở lại tab Bình luận.',
    };
  }
  if (isDenied) {
    return {
      permission: 'pages_read_user_content',
      message:
        'Facebook từ chối đọc bình luận. Thường cần quyền pages_read_user_content (đọc bình luận) và pages_manage_engagement (ẩn / trả lời). Xin các quyền này trên Meta App rồi thử lại.',
    };
  }
  return null;
}

export function commentHasPhone(message: string): boolean {
  return extractContacts(message).phones.length > 0;
}

export function mapGraphAttachments(raw: unknown): MessageAttachment[] {
  const data = raw && typeof raw === 'object' ? (raw as { data?: unknown }).data : raw;
  const list = Array.isArray(data) ? data : [];
  const out: MessageAttachment[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const image = row.image_data && typeof row.image_data === 'object' ? (row.image_data as Record<string, unknown>) : null;
    const video = row.video_data && typeof row.video_data === 'object' ? (row.video_data as Record<string, unknown>) : null;
    const url = String(image?.url ?? image?.preview_url ?? video?.url ?? row.file_url ?? row.url ?? '').trim();
    if (!url) continue;
    const mime = String(row.mime_type ?? '').trim();
    const isImage = /^image\//i.test(mime) || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url) || Boolean(image);
    out.push({
      type: isImage ? 'image' : String(row.type ?? mime ?? 'file'),
      url,
      mime_type: mime,
      name: String(row.name ?? '').slice(0, 200),
    });
  }
  return out;
}

function defaultFetcher(): GraphFetcher {
  return async (url, init) => {
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: response.ok, status: response.status, body, headers: response.headers };
  };
}

async function graphJson(
  pathOrUrl: string,
  token: string,
  init: RequestInit | undefined,
  fetcher: GraphFetcher,
): Promise<{ body: Record<string, unknown> | null; error: string }> {
  if (shouldPauseGraph()) {
    return { body: null, error: 'Facebook tạm dừng gọi API vì gần đạt giới hạn. Thử lại sau.' };
  }
  const isUrl = pathOrUrl.startsWith('http');
  const url = isUrl
    ? pathOrUrl
    : `${GRAPH}/${pathOrUrl}${pathOrUrl.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`;
  try {
    recordGraphCall(classifyGraphPath(pathOrUrl));
    const headers = new Headers(init?.headers);
    if (init?.method && init.method !== 'GET' && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const result = await fetcher(url, { ...init, headers, signal: init?.signal ?? AbortSignal.timeout(12_000) });
    noteGraphHeaders(result.headers);
    if (!result.ok || !result.body) {
      const errObj = result.body?.error as { message?: string; code?: number } | undefined;
      const error = String(errObj?.message ?? (result.body ? JSON.stringify(result.body) : 'Facebook từ chối yêu cầu.'));
      noteGraphError(error, extractGraphErrorCode(result.body));
      return { body: null, error };
    }
    if (result.body.error) {
      const error = String((result.body.error as { message?: string }).message ?? 'Facebook từ chối yêu cầu.');
      noteGraphError(error, extractGraphErrorCode(result.body));
      return { body: null, error };
    }
    return { body: result.body, error: '' };
  } catch (err) {
    return { body: null, error: err instanceof Error ? err.message : 'Không gọi được Facebook.' };
  }
}

type GraphComment = {
  id?: string;
  from?: { id?: string; name?: string };
  message?: string;
  created_time?: string;
  parent?: { id?: string };
  is_hidden?: boolean;
  can_hide?: boolean;
  can_comment?: boolean;
  can_reply_privately?: boolean;
  comment_count?: number;
  comments?: { data?: GraphComment[] };
};

function mapComment(
  pageId: string,
  postId: string,
  raw: GraphComment,
  parentId = '',
): PulledComment[] {
  const id = String(raw.id ?? '').trim();
  if (!id) return [];
  const kids = raw.comments?.data ?? [];
  const pageReplied = kids.some((child) => String(child.from?.id ?? '') === pageId);
  const row: PulledComment = {
    comment_id: id,
    page_id: pageId,
    post_id: postId,
    parent_id: String(raw.parent?.id ?? parentId ?? '').trim(),
    from_name: String(raw.from?.name ?? '').trim() || 'Người dùng Facebook',
    from_id: String(raw.from?.id ?? '').trim().slice(0, 64),
    message: String(raw.message ?? '').slice(0, 4000),
    created_time: String(raw.created_time ?? ''),
    is_hidden: raw.is_hidden === true,
    replied: pageReplied || Number(raw.comment_count ?? 0) > 0 && kids.some((c) => String(c.from?.id ?? '') === pageId),
    can_hide: raw.can_hide !== false,
    can_reply: raw.can_comment !== false,
    can_reply_privately: raw.can_reply_privately !== false,
  };
  const out = [row];
  for (const child of kids) out.push(...mapComment(pageId, postId, child, id));
  return out;
}

export async function pullFacebookComments(
  pageId: string,
  token: string,
  opts?: { fetcher?: GraphFetcher; limit?: number },
): Promise<PullCommentsResult> {
  const empty: PullCommentsResult = {
    posts: [],
    comments: [],
    hops: 0,
    error: '',
    permissionError: '',
    permissionNeeded: '',
  };
  if (shouldPauseGraph()) {
    return { ...empty, error: 'Facebook tạm dừng gọi API vì gần đạt giới hạn. Thử lại sau.' };
  }
  const fetcher = opts?.fetcher ?? defaultFetcher();
  const limit = Math.min(15, Math.max(5, opts?.limit ?? 10));
  const path = `${encodeURIComponent(pageId)}/published_posts?fields=${POST_FIELDS}&limit=${limit}`;
  const result = await graphJson(path, token, { method: 'GET' }, fetcher);
  const hops = 1;
  if (result.error) {
    const perm = parseCommentPermissionError(result.error);
    return {
      ...empty,
      hops,
      error: perm ? perm.message : 'Facebook không trả bài viết hoặc bình luận của Page.',
      permissionError: perm?.message ?? '',
      permissionNeeded: perm?.permission ?? '',
    };
  }
  const data = Array.isArray(result.body?.data) ? (result.body?.data as Array<Record<string, unknown>>) : [];
  const posts: PulledFbPost[] = [];
  const comments: PulledComment[] = [];
  for (const raw of data) {
    const postId = String(raw.id ?? '').trim();
    if (!postId) continue;
    posts.push({
      post_id: postId,
      page_id: pageId,
      message: String(raw.message ?? '').slice(0, 4000),
      permalink: String(raw.permalink_url ?? '').slice(0, 500),
      picture: String(raw.full_picture ?? '').slice(0, 500),
      created_time: String(raw.created_time ?? ''),
    });
    const batch = (raw.comments as { data?: GraphComment[] } | undefined)?.data ?? [];
    for (const comment of batch) comments.push(...mapComment(pageId, postId, comment));
  }
  return { posts, comments, hops, error: '', permissionError: '', permissionNeeded: '' };
}

export async function hideFacebookComment(
  commentId: string,
  token: string,
  hidden: boolean,
  opts?: { fetcher?: GraphFetcher },
): Promise<{ ok: boolean; error: string; permissionNeeded: string }> {
  if (shouldPauseGraph()) {
    return { ok: false, error: 'Facebook tạm dừng gọi API vì gần đạt giới hạn. Thử lại sau.', permissionNeeded: '' };
  }
  const fetcher = opts?.fetcher ?? defaultFetcher();
  const path = `${encodeURIComponent(commentId)}`;
  const result = await graphJson(
    path,
    token,
    { method: 'POST', body: JSON.stringify({ is_hidden: hidden }) },
    fetcher,
  );
  if (result.error) {
    const perm = parseCommentPermissionError(result.error);
    return {
      ok: false,
      error: perm?.message ?? 'Facebook không ẩn hoặc hiện được bình luận này.',
      permissionNeeded: perm?.permission ?? (perm ? perm.permission : 'pages_manage_engagement'),
    };
  }
  return { ok: true, error: '', permissionNeeded: '' };
}

export async function replyFacebookComment(
  commentId: string,
  token: string,
  text: string,
  mode: 'public' | 'private',
  opts?: { fetcher?: GraphFetcher },
): Promise<{ ok: boolean; id: string; error: string; permissionNeeded: string }> {
  const body = text.trim().slice(0, 2000);
  if (!body) return { ok: false, id: '', error: 'Cần nội dung trả lời.', permissionNeeded: '' };
  if (shouldPauseGraph()) {
    return { ok: false, id: '', error: 'Facebook tạm dừng gọi API vì gần đạt giới hạn. Thử lại sau.', permissionNeeded: '' };
  }
  const fetcher = opts?.fetcher ?? defaultFetcher();
  const edge = mode === 'private' ? 'private_replies' : 'comments';
  const path = `${encodeURIComponent(commentId)}/${edge}`;
  const result = await graphJson(path, token, { method: 'POST', body: JSON.stringify({ message: body }) }, fetcher);
  if (result.error) {
    const perm = parseCommentPermissionError(result.error);
    const needed =
      perm?.permission ?? (mode === 'private' ? 'pages_messaging' : 'pages_manage_engagement');
    return {
      ok: false,
      id: '',
      error:
        perm?.message ??
        (mode === 'private'
          ? 'Facebook không gửi được tin nhắn riêng cho người bình luận.'
          : 'Facebook không đăng được trả lời công khai.'),
      permissionNeeded: needed,
    };
  }
  const id = String(result.body?.id ?? result.body?.message_id ?? '').trim();
  return { ok: true, id, error: '', permissionNeeded: '' };
}

/** Comments whose message contains a phone, not already hidden — candidates for auto-hide. */
export function commentsToAutoHide(comments: PulledComment[]): PulledComment[] {
  return comments.filter((row) => !row.is_hidden && commentHasPhone(row.message) && row.parent_id === '');
}
