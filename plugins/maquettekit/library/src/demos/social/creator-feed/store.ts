/**
 * Optimistic participation store + a simulated server (no network: setTimeout latency, in-memory state).
 *
 *  - Toggles flip the visible state in the same frame; requests carry the FINAL intended state (not "toggle"), are
 *    debounced so rapid taps send one request, and carry an idempotency key so a retried request cannot double-count.
 *  - Success reconciles counts with the server's value; failure rolls back to the last confirmed state and records a
 *    reason that the UI shows next to the control and announces politely.
 *  - "Simulate failed requests" makes every request fail, so rollback can be seen on purpose.
 */
import { PROFILE, POSTS, type CommentData } from './data';

export type CommentState = CommentData & { state: 'sent' | 'sending' | 'failed'; mine?: boolean };
export type ToggleKind = 'liked' | 'saved';
export interface PostState { liked: boolean; saved: boolean; likes: number; error: { kind: ToggleKind; message: string } | null; comments: CommentState[] }
export interface FeedState {
  posts: Record<string, PostState>;
  following: boolean;
  followers: number;
  followError: string | null;
  drafts: Record<string, string>;
  fail: boolean;
  announce: { n: number; text: string };
}

const LATENCY = 650;
const DEBOUNCE = 320;
const titleOf = (id: string) => POSTS.find((p) => p.id === id)?.title ?? 'this post';

export function createFeedStore() {
  let state: FeedState = {
    posts: Object.fromEntries(POSTS.map((p) => [p.id, { liked: false, saved: false, likes: p.likes, error: null, comments: p.comments.map((c) => ({ ...c, state: 'sent' as const })) }])),
    following: false, followers: PROFILE.followers, followError: null, drafts: {}, fail: false, announce: { n: 0, text: '' },
  };
  const listeners = new Set<() => void>();
  const set = (fn: (s: FeedState) => FeedState) => { state = fn(state); listeners.forEach((l) => l()); };
  const patchPost = (id: string, patch: Partial<PostState>) => set((s) => ({ ...s, posts: { ...s.posts, [id]: { ...s.posts[id], ...patch } } }));
  const say = (text: string) => set((s) => ({ ...s, announce: { n: s.announce.n + 1, text } }));

  // ── simulated server ──
  const server = {
    liked: Object.fromEntries(POSTS.map((p) => [p.id, false])) as Record<string, boolean>,
    saved: Object.fromEntries(POSTS.map((p) => [p.id, false])) as Record<string, boolean>,
    likes: Object.fromEntries(POSTS.map((p) => [p.id, p.likes])) as Record<string, number>,
    following: false, followers: PROFILE.followers as number,
    seen: new Map<string, unknown>(),
  };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let alive = true;
  const later = (fn: () => void, ms: number) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); return t; };
  /** One request: resolves after LATENCY with `apply()`'s result; the same key always returns the first result. */
  const request = <T,>(key: string, apply: () => T): Promise<T> => {
    const willFail = state.fail;
    return new Promise<T>((resolve, reject) => {
      later(() => {
        if (willFail) { reject(new Error('offline')); return; }
        if (!server.seen.has(key)) server.seen.set(key, apply());
        resolve(server.seen.get(key) as T);
      }, LATENCY + Math.round(Math.random() * 200));
    });
  };

  // ── optimistic toggles (like / save) ──
  const confirmed: Record<string, boolean> = {};
  const confirmedLikes: Record<string, number> = Object.fromEntries(POSTS.map((p) => [p.id, p.likes]));
  const debounce = new Map<string, ReturnType<typeof setTimeout>>();
  const seq: Record<string, number> = {};
  let keyN = 0;

  const commit = (id: string, kind: ToggleKind) => {
    const k = `${id}:${kind}`;
    debounce.delete(k);
    const want = state.posts[id][kind];
    if (want === (confirmed[k] ?? false)) return;
    const n = (seq[k] = (seq[k] ?? 0) + 1);
    const key = `${k}:${want}:${++keyN}`;
    request(key, () => {
      if (server[kind][id] !== want) { server[kind][id] = want; if (kind === 'liked') server.likes[id] += want ? 1 : -1; }
      return { value: want, likes: server.likes[id] };
    }).then((res) => {
      confirmed[k] = res.value;
      if (kind === 'liked') confirmedLikes[id] = res.likes;
      if (seq[k] !== n) return;
      const p = state.posts[id];
      // Reconcile with the server's count unless the person has already changed their mind again.
      if (kind === 'liked' && p.liked === res.value) patchPost(id, { likes: res.likes });
    }, () => {
      if (seq[k] !== n || debounce.has(k)) return; // a newer intent is queued; it will be sent instead
      const message = kind === 'liked'
        ? `Couldn’t ${want ? 'like' : 'unlike'} “${titleOf(id)}”. Your change was undone — try again.`
        : `Couldn’t ${want ? 'save' : 'unsave'} “${titleOf(id)}”. Your change was undone — try again.`;
      patchPost(id, kind === 'liked'
        ? { liked: confirmed[k] ?? false, likes: confirmedLikes[id], error: { kind, message } }
        : { saved: confirmed[k] ?? false, error: { kind, message } });
      say(message);
    });
  };

  const toggle = (id: string, kind: ToggleKind) => {
    const p = state.posts[id];
    const next = !p[kind];
    patchPost(id, kind === 'liked' ? { liked: next, likes: p.likes + (next ? 1 : -1), error: null } : { saved: next, error: null });
    const k = `${id}:${kind}`;
    const t = debounce.get(k);
    if (t) { clearTimeout(t); timers.delete(t); }
    debounce.set(k, later(() => commit(id, kind), DEBOUNCE));
  };

  // ── follow ──
  let followSeq = 0;
  let followConfirmed = { following: false, followers: PROFILE.followers as number };
  let followTimer: ReturnType<typeof setTimeout> | null = null;
  const commitFollow = () => {
    followTimer = null;
    const want = state.following;
    if (want === followConfirmed.following) return;
    const n = ++followSeq;
    request(`follow:${want}:${++keyN}`, () => {
      if (server.following !== want) { server.following = want; server.followers += want ? 1 : -1; }
      return { following: server.following, followers: server.followers };
    }).then((res) => {
      followConfirmed = res;
      if (n === followSeq && state.following === res.following) set((s) => ({ ...s, followers: res.followers }));
    }, () => {
      if (n !== followSeq || followTimer) return;
      const message = `Couldn’t ${want ? 'follow' : 'unfollow'} ${PROFILE.name}. Your change was undone — try again.`;
      set((s) => ({ ...s, following: followConfirmed.following, followers: followConfirmed.followers, followError: message }));
      say(message);
    });
  };

  // ── comments ──
  let localN = 0;
  const sendComment = (postId: string, cid: string) => {
    request(`comment:${cid}:${++keyN}`, () => true).then(() => {
      updateComment(postId, cid, { state: 'sent' });
      say('Comment posted.');
    }, () => {
      updateComment(postId, cid, { state: 'failed' });
      say('Couldn’t post your comment. It is kept in the list with a Retry button.');
    });
  };
  const updateComment = (postId: string, cid: string, patch: Partial<CommentState>) => {
    const p = state.posts[postId];
    patchPost(postId, { comments: p.comments.map((c) => (c.id === cid ? { ...c, ...patch } : c)) });
  };

  return {
    get: () => state,
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
    revive: () => { alive = true; },
    dispose: () => { alive = false; timers.forEach(clearTimeout); timers.clear(); debounce.clear(); },
    toggle,
    likeOnce: (id: string) => { if (!state.posts[id].liked) toggle(id, 'liked'); },
    clearError: (id: string) => patchPost(id, { error: null }),
    toggleFollow: () => {
      set((s) => ({ ...s, following: !s.following, followers: s.followers + (s.following ? -1 : 1), followError: null }));
      if (followTimer) { clearTimeout(followTimer); timers.delete(followTimer); }
      followTimer = later(commitFollow, DEBOUNCE);
    },
    setFail: (fail: boolean) => set((s) => ({ ...s, fail })),
    setDraft: (id: string, text: string) => set((s) => ({ ...s, drafts: { ...s.drafts, [id]: text } })),
    postComment: (postId: string, text: string) => {
      const cid = `mine-${++localN}`;
      const comment: CommentState = { id: cid, author: 'You', initials: 'YOU', iso: new Date().toISOString(), ago: 'now', text, state: 'sending', mine: true };
      set((s) => ({ ...s, drafts: { ...s.drafts, [postId]: '' }, posts: { ...s.posts, [postId]: { ...s.posts[postId], comments: [...s.posts[postId].comments, comment] } } }));
      sendComment(postId, cid);
      return cid;
    },
    retryComment: (postId: string, cid: string) => {
      const c = state.posts[postId].comments.find((x) => x.id === cid);
      if (!c) return;
      updateComment(postId, cid, { state: 'sending' });
      sendComment(postId, cid);
    },
    /** Take a failed comment back into the composer. */
    editComment: (postId: string, cid: string) => {
      const c = state.posts[postId].comments.find((x) => x.id === cid);
      if (!c) return;
      set((s) => ({ ...s, drafts: { ...s.drafts, [postId]: c.text }, posts: { ...s.posts, [postId]: { ...s.posts[postId], comments: s.posts[postId].comments.filter((x) => x.id !== cid) } } }));
    },
    say,
  };
}

export type FeedStore = ReturnType<typeof createFeedStore>;
