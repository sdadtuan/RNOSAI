import { resetGraphUsageForTests } from './portal-graph-usage';
import {
  commentHasPhone,
  commentsToAutoHide,
  hideFacebookComment,
  mapGraphAttachments,
  parseCommentPermissionError,
  pullFacebookComments,
  replyFacebookComment,
  type GraphFetcher,
  type PulledComment,
} from './portal-page-comments.util';

function jsonFetcher(payload: unknown, status = 200): GraphFetcher {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    body: payload as Record<string, unknown>,
    headers: new Headers(),
  });
}

beforeEach(() => {
  resetGraphUsageForTests();
});

describe('parseCommentPermissionError', () => {
  it('detects pages_read_user_content', () => {
    const parsed = parseCommentPermissionError(
      '(#200) Requires pages_read_user_content permission to manage the object',
    );
    expect(parsed?.permission).toBe('pages_read_user_content');
    expect(parsed?.message).toMatch(/pages_read_user_content/);
  });

  it('detects pages_manage_engagement', () => {
    const parsed = parseCommentPermissionError('(#200) Requires pages_manage_engagement to hide comments');
    expect(parsed?.permission).toBe('pages_manage_engagement');
  });
});

describe('commentHasPhone / auto-hide candidates', () => {
  it('picks top-level comments that contain a VN phone and are visible', () => {
    const rows: PulledComment[] = [
      {
        comment_id: '1',
        page_id: 'p',
        post_id: 't',
        parent_id: '',
        from_name: 'A',
        from_id: 'a',
        message: 'Lh mình 0912 345 678 nhé',
        created_time: '',
        is_hidden: false,
        replied: false,
        can_hide: true,
        can_reply: true,
        can_reply_privately: true,
      },
      {
        comment_id: '2',
        page_id: 'p',
        post_id: 't',
        parent_id: '',
        from_name: 'B',
        from_id: 'b',
        message: 'Xin chào',
        created_time: '',
        is_hidden: false,
        replied: false,
        can_hide: true,
        can_reply: true,
        can_reply_privately: true,
      },
      {
        comment_id: '3',
        page_id: 'p',
        post_id: 't',
        parent_id: '',
        from_name: 'C',
        from_id: 'c',
        message: '+84912345678',
        created_time: '',
        is_hidden: true,
        replied: false,
        can_hide: true,
        can_reply: true,
        can_reply_privately: true,
      },
    ];
    expect(commentHasPhone(rows[0].message)).toBe(true);
    expect(commentsToAutoHide(rows).map((item) => item.comment_id)).toEqual(['1']);
  });
});

describe('mapGraphAttachments', () => {
  it('extracts an image url from image_data', () => {
    const mapped = mapGraphAttachments({
      data: [{ mime_type: 'image/jpeg', image_data: { url: 'https://cdn.example.com/a.jpg' }, name: 'a.jpg' }],
    });
    expect(mapped).toEqual([
      { type: 'image', url: 'https://cdn.example.com/a.jpg', mime_type: 'image/jpeg', name: 'a.jpg' },
    ]);
  });
});

describe('pullFacebookComments (mocked Graph)', () => {
  it('maps posts and nested comments, and marks a Page reply as replied', async () => {
    const pageId = '111';
    const fetcher = jsonFetcher({
      data: [
        {
          id: '111_222',
          message: 'Bài đăng',
          created_time: '2026-11-12T00:00:00+0000',
          permalink_url: 'https://fb.com/p',
          full_picture: '',
          comments: {
            data: [
              {
                id: 'c1',
                from: { id: 'user1', name: 'Lan' },
                message: 'Giá sao ạ',
                created_time: '2026-11-12T01:00:00+0000',
                is_hidden: false,
                comments: {
                  data: [
                    {
                      id: 'c1r',
                      from: { id: pageId, name: 'Page' },
                      message: 'Dạ ạ',
                      created_time: '2026-11-12T01:05:00+0000',
                      parent: { id: 'c1' },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    });
    const pulled = await pullFacebookComments(pageId, 'tok', { fetcher });
    expect(pulled.permissionError).toBe('');
    expect(pulled.posts).toHaveLength(1);
    expect(pulled.comments).toHaveLength(2);
    const parent = pulled.comments.find((row) => row.comment_id === 'c1');
    expect(parent?.replied).toBe(true);
    expect(parent?.from_name).toBe('Lan');
  });

  it('returns a Vietnamese permission message when Graph denies access', async () => {
    const fetcher = jsonFetcher(
      { error: { message: '(#200) Requires pages_read_user_content permission', code: 200 } },
      403,
    );
    const pulled = await pullFacebookComments('111', 'tok', { fetcher });
    expect(pulled.posts).toHaveLength(0);
    expect(pulled.permissionNeeded).toBe('pages_read_user_content');
    expect(pulled.permissionError).toMatch(/pages_read_user_content/);
  });
});

describe('write helpers (mocked — never hit real comments)', () => {
  it('hideFacebookComment posts is_hidden', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher: GraphFetcher = async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, body: { success: true }, headers: new Headers() };
    };
    const result = await hideFacebookComment('123', 'tok', true, { fetcher });
    expect(result.ok).toBe(true);
    expect(calls[0].init?.method).toBe('POST');
    expect(String(calls[0].init?.body)).toContain('is_hidden');
  });

  it('replyFacebookComment public vs private uses the right edge', async () => {
    const paths: string[] = [];
    const fetcher: GraphFetcher = async (url) => {
      paths.push(url);
      return { ok: true, status: 200, body: { id: 'r1' }, headers: new Headers() };
    };
    const pub = await replyFacebookComment('123', 'tok', 'Xin chào', 'public', { fetcher });
    const priv = await replyFacebookComment('123', 'tok', 'Xin chào', 'private', { fetcher });
    expect(pub.ok && priv.ok).toBe(true);
    expect(paths[0]).toContain('/comments');
    expect(paths[1]).toContain('/private_replies');
  });

  it('does not call Graph when the reply text is empty', async () => {
    let called = 0;
    const fetcher: GraphFetcher = async () => {
      called += 1;
      return { ok: true, status: 200, body: {}, headers: new Headers() };
    };
    const result = await replyFacebookComment('123', 'tok', '   ', 'public', { fetcher });
    expect(result.ok).toBe(false);
    expect(called).toBe(0);
  });
});
