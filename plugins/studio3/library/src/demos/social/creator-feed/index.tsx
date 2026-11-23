'use client';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react';
import LikeHeartMorph from '../../../effects/like-heart-morph';
import { meta as likeMeta } from '../../../effects/like-heart-morph/meta';
import ReactionBurst from '../../../effects/reaction-burst';
import { meta as burstMeta } from '../../../effects/reaction-burst/meta';
import { duration as D, spring, springToLinear, useStudioMotion } from '../../../motion';
import type { EffectMeta, ParamValues } from '../../../types';
import { EDITIONS, POSTS, PROFILE, SAMPLE_NOW, type PostData } from './data';
import { MorphToggle } from './MorphToggle';
import { PrintArt, RegMark } from './Prints';
import { Sheet } from './Sheet';
import { createFeedStore, type CommentState, type FeedStore, type PostState } from './store';
import styles from './styles.module.css';

const defaults = (m: EffectMeta): ParamValues => Object.fromEntries(m.params.map((p) => [p.key, p.default]));
const POP = springToLinear(spring.pop);
const absolute = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' GMT';
const PROOFS = [
  { offset: 3, caption: 'Proof 1 — three millimetres out', alt: 'Proof one: the coral plate sits three millimetres low and right, so every corner mark is doubled.' },
  { offset: 1, caption: 'Proof 2 — one millimetre out', alt: 'Proof two: the corner marks almost meet; a thin coral edge shows along the coast.' },
  { offset: 0, caption: 'Proof 3 — in register', alt: 'Proof three: blue and coral corner marks sit exactly on top of each other.' },
];

type SheetState = { type: 'comments' | 'share'; postId: string } | { type: 'share-profile' } | null;

export default function CreatorFeed() {
  const [store] = useState<FeedStore>(createFeedStore);
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const uid = useId();
  const [tab, setTab] = useState<'notes' | 'editions'>('notes');
  const [hideCounts, setHideCounts] = useState(false);
  const [suggestions, setSuggestions] = useState(true);
  const [sheet, setSheet] = useState<SheetState>(null);

  useEffect(() => { store.revive(); return () => store.dispose(); }, [store]);
  useEffect(() => { if (window.location.hash === '#editions') setTab('editions'); }, []);

  const selectTab = (next: 'notes' | 'editions', focus = false) => {
    setTab(next);
    try { history.replaceState(history.state, '', next === 'editions' ? '#editions' : window.location.pathname + window.location.search); } catch { /* sandboxed */ }
    if (focus) document.getElementById(`${uid}-tab-${next}`)?.focus();
  };
  const onTabKey = (e: KeyboardEvent) => {
    const order = ['notes', 'editions'] as const;
    const i = order.indexOf(tab);
    const to = e.key === 'ArrowRight' || e.key === 'ArrowLeft' ? order[(i + 1) % order.length] : e.key === 'Home' ? order[0] : e.key === 'End' ? order[order.length - 1] : null;
    if (to) { e.preventDefault(); selectTab(to, true); }
  };

  const share = useCallback(async (title: string, text: string, hash: string, fallback: SheetState) => {
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    const data = { title, text, url };
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof nav.share === 'function' && (!nav.canShare || nav.canShare(data))) {
      try { await nav.share(data); store.say('Shared.'); return; }
      catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    setSheet(fallback);
  }, [store]);

  const onFeedKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'PageDown' && e.key !== 'PageUp') return;
    const articles = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(':scope > article'));
    const at = articles.findIndex((a) => a.contains(document.activeElement));
    const next = articles[Math.max(0, Math.min(articles.length - 1, at + (e.key === 'PageDown' ? 1 : -1)))];
    if (next) { e.preventDefault(); next.focus(); }
  };

  const openPost = sheet && sheet.type !== 'share-profile' ? POSTS.find((p) => p.id === sheet.postId) ?? null : null;

  return (
    <div className={styles.root}>
      <div className={styles.page} inert={sheet !== null}>
        <p className={styles.sampleBar}>
          <span className="s3-label">Sample content</span>
          <span>Ines, Tidewater Print Club and every post, name and count here are fictional.</span>
        </p>

        <div className={styles.layout}>
          <header className={styles.proof} aria-labelledby={`${uid}-name`}>
            <RegMark className={`${styles.reg} ${styles.regTL}`} /><RegMark className={`${styles.reg} ${styles.regTR}`} />
            <RegMark className={`${styles.reg} ${styles.regBL}`} /><RegMark className={`${styles.reg} ${styles.regBR}`} />
            <div className={styles.slugRow}>
              <span className="s3-label">Tidewater Print Club · member 014</span>
              <span className={styles.inks} aria-hidden="true"><i /><i /></span>
            </div>
            <div className={styles.nameRow}>
              <span className={styles.avatar} aria-hidden="true">IV</span>
              <h2 id={`${uid}-name`} className={styles.name}>
                <span className={styles.nameInk}>Ines <br />Varga</span>
                <span className={styles.nameCoral} aria-hidden="true">Ines <br />Varga</span>
              </h2>
            </div>
            <p className={styles.handle}>@{PROFILE.handle} · {PROFILE.place}</p>
            <p className={styles.role}>{PROFILE.role}</p>
            <p className={styles.bio} dir="auto">{PROFILE.bio}</p>
            <dl className={styles.stats}>
              <div><dt>Field notes</dt><dd>{PROFILE.posts}</dd></div>
              <div><dt>Followers</dt><dd>{state.followers.toLocaleString('en-GB')}</dd></div>
              <div><dt>Following</dt><dd>{PROFILE.following}</dd></div>
            </dl>
            <p className={`s3-label ${styles.muted}`}>Counts are sample data</p>
            <div className={styles.profileActions}>
              <button type="button" className={styles.follow} aria-pressed={state.following} onClick={store.toggleFollow}>
                <span className="s3-sr-only">Follow {PROFILE.name}</span>
                <span aria-hidden="true">{state.following ? 'Following' : 'Follow'}</span>
              </button>
              <button type="button" className={styles.ghostBtn} aria-haspopup="dialog" onClick={() => void share(`${PROFILE.name} on Tidewater`, PROFILE.role, '', { type: 'share-profile' })}>
                <ShareIcon /> Share profile
              </button>
            </div>
            {state.followError ? <p className={styles.inlineError}>{state.followError}</p> : null}
          </header>

          <div className={styles.main}>
            <div className={styles.settings} role="group" aria-label="Feed settings">
              <Switch label="Hide like counts" checked={hideCounts} onChange={setHideCounts} />
              <Switch label="Simulate failed requests" note="demo" checked={state.fail} onChange={store.setFail} />
            </div>

            <div role="tablist" aria-label={`${PROFILE.name}’s work`} className={styles.tabs} onKeyDown={onTabKey}>
              {(['notes', 'editions'] as const).map((t) => (
                <button key={t} type="button" role="tab" id={`${uid}-tab-${t}`} aria-selected={tab === t} aria-controls={`${uid}-panel-${t}`} tabIndex={tab === t ? 0 : -1} className={styles.tab} onClick={() => selectTab(t)}>
                  {t === 'notes' ? 'Field notes' : 'Editions'}
                </button>
              ))}
            </div>

            <div role="tabpanel" id={`${uid}-panel-notes`} aria-labelledby={`${uid}-tab-notes`} hidden={tab !== 'notes'}>
              <section className={styles.pinned} aria-labelledby={`${uid}-pinned`}>
                <div className={styles.pinnedHead}>
                  <h3 id={`${uid}-pinned`} className="s3-label">Pinned · field note 14</h3>
                  <span className={`s3-label ${styles.muted}`}><time dateTime="2026-11-23T08:40:00Z" title={absolute('2026-11-23T08:40:00Z')}>1 h<span className="s3-sr-only"> ago</span></time></span>
                </div>
                <div className={styles.pinnedStage}>
                  <span className={styles.pinnedNo} aria-hidden="true">14</span>
                  <ReactionBurst params={{ ...defaults(burstMeta), count: 18, power: 560, gravity: 1100, spread: 64, spin: 6 }} />
                </div>
              </section>

              <p className={styles.feedNote}><span className="s3-label">Newest first</span> Chronological — nothing here is ranked or boosted.</p>
              <div role="feed" aria-busy="false" aria-label={`Field notes from ${PROFILE.name}`} className={styles.feed} onKeyDown={onFeedKey}>
                {POSTS.map((p, i) => (
                  <Post
                    key={p.id} post={p} index={i} total={POSTS.length} s={state.posts[p.id]} store={store} hideCounts={hideCounts} uid={uid}
                    onComments={() => setSheet({ type: 'comments', postId: p.id })}
                    onShare={() => void share(`${p.title} — ${PROFILE.name}`, p.text, `#note-${p.no}`, { type: 'share', postId: p.id })}
                  />
                ))}
              </div>

              <section className={styles.caughtUp} aria-labelledby={`${uid}-end`}>
                <svg viewBox="-20 -20 40 40" aria-hidden="true" focusable="false" className={styles.caughtMark}>
                  <circle r="11" /><path d="M-17 0h34M0-17v34" /><path d="M-5 0l3.5 3.5L6-4" className={styles.caughtTick} />
                </svg>
                <h3 id={`${uid}-end`} className={styles.caughtTitle}>You’re all caught up</h3>
                <p>That’s every field note Ines posted in the last 30 days. Older work lives under Editions — there is nothing more to scroll here.</p>
              </section>

              {suggestions ? (
                <section className={styles.suggested} aria-labelledby={`${uid}-sugg`}>
                  <div className={styles.suggestedHead}>
                    <div>
                      <h3 id={`${uid}-sugg`} className="s3-label">Suggested reading</h3>
                      <p className={styles.muted}>Not from accounts you follow. Ines is printing this essay as a zine next month.</p>
                    </div>
                    <button type="button" className={styles.ghostBtn} onClick={() => { setSuggestions(false); store.say('Suggestions hidden.'); }}>Hide suggestions</button>
                  </div>
                  <LikeHeartMorph params={{ ...defaults(likeMeta), size: 34, spring: 'pop', rays: 8, speed: 1 }} />
                </section>
              ) : null}
            </div>

            <div role="tabpanel" id={`${uid}-panel-editions`} aria-labelledby={`${uid}-tab-editions`} hidden={tab !== 'editions'}>
              <ul className={styles.editions}>
                {EDITIONS.map((e) => (
                  <li key={e.id} className={styles.edition}>
                    <div role="img" aria-label={`Print: ${e.title}`} className={styles.editionArt}><PrintArt media={e.media} /></div>
                    <p className={styles.editionTitle}>{e.title}</p>
                    <p className={styles.muted}>{e.detail}</p>
                  </li>
                ))}
              </ul>
              <p className={`s3-label ${styles.muted}`}>Sample content · editions are fictional</p>
            </div>

            <footer className={styles.footer}>
              <p>Tidewater Print Club is a fictional community. Field notes are listed newest first, as of {absolute(SAMPLE_NOW)}.</p>
            </footer>
          </div>
        </div>
      </div>

      {sheet?.type === 'comments' && openPost ? (
        <Sheet kicker={`Field note ${openPost.no}`} title={`Comments on “${openPost.title}”`} onClose={() => setSheet(null)}
          footer={<Composer postId={openPost.id} store={store} draft={state.drafts[openPost.id] ?? ''} uid={uid} />}>
          <Comments postId={openPost.id} comments={state.posts[openPost.id].comments} store={store} />
        </Sheet>
      ) : null}
      {sheet?.type === 'share' && openPost ? (
        <Sheet kicker={`Field note ${openPost.no}`} title={`Share “${openPost.title}”`} onClose={() => setSheet(null)}>
          <CopyLink hash={`#note-${openPost.no}`} store={store} />
        </Sheet>
      ) : null}
      {sheet?.type === 'share-profile' ? (
        <Sheet kicker="Profile" title={`Share ${PROFILE.name}’s profile`} onClose={() => setSheet(null)}>
          <CopyLink hash="" store={store} />
        </Sheet>
      ) : null}

      <p role="status" aria-live="polite" className="s3-sr-only">{state.announce.text}{state.announce.n % 2 ? ' ' : ''}</p>
    </div>
  );
}

function Post({ post: p, index, total, s, store, hideCounts, uid, onComments, onShare }: {
  post: PostData; index: number; total: number; s: PostState; store: FeedStore; hideCounts: boolean; uid: string;
  onComments: () => void; onShare: () => void;
}) {
  const { reduced } = useStudioMotion();
  const pop = useRef<HTMLSpanElement>(null);
  const tap = useRef({ t: 0, x: 0, y: 0 });
  const anim = useRef<Animation | null>(null);
  useEffect(() => () => anim.current?.cancel(), []);
  const id = `${uid}-${p.id}`;
  const comments = s.comments.filter((c) => c.state !== 'failed').length;

  const likeFromMedia = () => {
    store.likeOnce(p.id);
    const el = pop.current;
    if (reduced || !el || typeof el.animate !== 'function') return;
    anim.current?.cancel();
    anim.current = el.animate([
      { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.08)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%, -60%) scale(0.96)', opacity: 0 },
    ], { duration: POP.duration + D.moderate, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  };
  // Touch double-tap (mouse uses dblclick). A shortcut only: the Like button stays visible.
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    const last = tap.current;
    if (e.timeStamp - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) { tap.current = { t: 0, x: 0, y: 0 }; likeFromMedia(); }
    else tap.current = { t: e.timeStamp, x: e.clientX, y: e.clientY };
  };

  return (
    <article id={`note-${p.no}`} className={styles.post} aria-labelledby={`${id}-by`} aria-describedby={`${id}-text`} aria-posinset={index + 1} aria-setsize={total} tabIndex={-1}>
      <div className={styles.postHead}>
        <span className={styles.avatarSm} aria-hidden="true">IV</span>
        <p id={`${id}-by`} className={styles.byline}>
          <span className={styles.author}>{PROFILE.name}</span>
          <span className={styles.meta}>Field note {p.no} · <time dateTime={p.iso} title={absolute(p.iso)}>{p.ago}<span className="s3-sr-only"> ago</span></time></span>
        </p>
        <span className={styles.slug} aria-hidden="true">Nº&nbsp;{p.no}</span>
      </div>

      {p.media === 'proofs' ? <Proofs /> : p.media ? (
        <figure className={styles.media} onDoubleClick={likeFromMedia} onPointerUp={onPointerUp}>
          <div role="img" aria-label={p.alt} className={styles.mediaArt}><PrintArt media={p.media} /></div>
          <span ref={pop} className={styles.heartPop} aria-hidden="true">
            <svg viewBox="0 0 48 48"><path d="M24 40.500 9.800 26.300a9.600 9.600 0 0 1 0-13.600 9.500 9.500 0 0 1 13.400 0l.8.8.8-.8a9.500 9.500 0 0 1 13.400 0 9.600 9.600 0 0 1 0 13.600z" /></svg>
          </span>
        </figure>
      ) : null}

      <p id={`${id}-text`} className={p.media ? styles.postText : styles.postTextLarge} dir="auto">{p.text}</p>

      <div className={styles.actions}>
        <MorphToggle kind="like" pressed={s.liked} onToggle={() => store.toggle(p.id, 'liked')} count={s.likes} showCount={!hideCounts} />
        <button type="button" className={styles.action} aria-haspopup="dialog" onClick={onComments}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 5.5h15v10h-8l-4.5 3.5v-3.5h-2.5z" /></svg>
          <span className="s3-sr-only">Comments, </span><span className={styles.actionCount}>{comments}</span>
        </button>
        <button type="button" className={styles.action} onClick={onShare}>
          <ShareIcon /><span className={styles.actionLabel}>Share</span>
        </button>
        <span className={styles.actionsGap} />
        <MorphToggle kind="save" pressed={s.saved} onToggle={() => store.toggle(p.id, 'saved')} />
      </div>
      {s.error ? (
        <p className={styles.inlineError}>
          {s.error.message}{' '}
          <button type="button" className={styles.textBtn} onClick={() => { const kind = s.error!.kind; store.clearError(p.id); store.toggle(p.id, kind); }}>Try again</button>
        </p>
      ) : null}
    </article>
  );
}

function Proofs() {
  const { reduced } = useStudioMotion();
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const read = () => { raf = 0; setI(Math.max(0, Math.min(PROOFS.length - 1, Math.round(el.scrollLeft / Math.max(1, el.clientWidth))))); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  const go = (n: number) => {
    const el = track.current;
    if (!el) return;
    const to = Math.max(0, Math.min(PROOFS.length - 1, n));
    el.scrollTo({ left: to * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
    setI(to);
  };
  return (
    <div className={styles.carousel} role="region" aria-roledescription="carousel" aria-label="Three proofs of the harbour chart">
      <div ref={track} className={styles.track} tabIndex={0} role="group" aria-label="Proofs — scroll sideways or use the buttons below">
        {PROOFS.map((pr, n) => (
          <div key={pr.offset} className={styles.slide} role="group" aria-roledescription="slide" aria-label={`${n + 1} of ${PROOFS.length}`}>
            <div role="img" aria-label={pr.alt} className={styles.mediaArt}><PrintArt media="proofs" offset={pr.offset} /></div>
          </div>
        ))}
      </div>
      <div className={styles.carouselBar}>
        <button type="button" className={styles.iconBtn} onClick={() => go(i - 1)} disabled={i === 0}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.5 6 8.500 12l6 6" /></svg><span className="s3-sr-only">Previous proof</span>
        </button>
        <p className={styles.carouselPos} aria-live="polite"><span className={styles.carouselNum}>{i + 1}/{PROOFS.length}</span> {PROOFS[i].caption}</p>
        <button type="button" className={styles.iconBtn} onClick={() => go(i + 1)} disabled={i === PROOFS.length - 1}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9.500 6 6 6-6 6" /></svg><span className="s3-sr-only">Next proof</span>
        </button>
      </div>
    </div>
  );
}

function Comments({ postId, comments, store }: { postId: string; comments: CommentState[]; store: FeedStore }) {
  const { reduced } = useStudioMotion();
  const list = useRef<HTMLOListElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const anims = useRef(new Set<Animation>());
  useEffect(() => { const a = anims.current; return () => { a.forEach((x) => x.cancel()); a.clear(); }; }, []);
  useEffect(() => {
    if (!seen.current) { seen.current = new Set(comments.map((c) => c.id)); return; }
    const el = list.current;
    if (!el) return;
    for (const c of comments) {
      if (seen.current.has(c.id)) continue;
      seen.current.add(c.id);
      const li = el.querySelector<HTMLElement>(`[data-cid="${c.id}"]`);
      if (!li || typeof li.animate !== 'function') continue;
      li.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      const h = li.offsetHeight;
      const a = reduced
        ? li.animate([{ opacity: 0 }, { opacity: 1 }], { duration: D.fast })
        : li.animate([{ opacity: 0, height: '0px', transform: 'translateY(10px)' }, { opacity: 1, height: `${h}px`, transform: 'none' }], { duration: D.moderate, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      anims.current.add(a);
      const done = () => anims.current.delete(a);
      a.finished.then(done, done);
    }
  }, [comments, reduced]);

  if (!comments.length) return <p className={styles.empty}>No comments yet. Say something kind about the print.</p>;
  return (
    <ol ref={list} className={styles.comments}>
      {comments.map((c) => (
        <li key={c.id} data-cid={c.id} className={styles.comment} data-state={c.state}>
          <span className={styles.avatarXs} aria-hidden="true">{c.initials}</span>
          <div className={styles.commentBody}>
            <p className={styles.commentMeta}>
              <span className={styles.author} dir="auto">{c.author}</span>{' '}
              <time dateTime={c.iso} title={absolute(c.iso)}>{c.ago}</time>
              {c.state === 'sending' ? <span className={styles.pending}> · Sending…</span> : null}
              {c.state === 'sent' && c.mine ? <span className={styles.muted}> · Posted</span> : null}
            </p>
            <p className={styles.commentText} dir="auto">{c.text}</p>
            {c.state === 'failed' ? (
              <p className={styles.inlineError}>
                Not posted — the connection failed.{' '}
                <button type="button" className={styles.textBtn} onClick={() => store.retryComment(postId, c.id)}>Retry</button>{' '}
                <button type="button" className={styles.textBtn} onClick={() => store.editComment(postId, c.id)}>Edit</button>
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Composer({ postId, store, draft, uid }: { postId: string; store: FeedStore; draft: string; uid: string }) {
  const id = `${uid}-composer`;
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    store.postComment(postId, text);
  };
  return (
    <form className={styles.composer} onSubmit={submit}>
      <label htmlFor={id} className={styles.composerLabel}>Add a comment</label>
      <textarea
        id={id} value={draft} rows={2} maxLength={280} dir="auto" aria-describedby={`${id}-hint`}
        onChange={(e) => store.setDraft(postId, e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
      />
      <div className={styles.composerRow}>
        <p id={`${id}-hint`} className={styles.hint}>Public: anyone who can see this field note can read it. Ctrl + Enter posts. Drafts are kept if you close this.</p>
        <button type="submit" className={styles.primaryBtn} disabled={!draft.trim()}>Post comment</button>
      </div>
    </form>
  );
}

function CopyLink({ hash, store }: { hash: string; store: FeedStore }) {
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const id = useId();
  useEffect(() => { setUrl(`${window.location.origin}${window.location.pathname}${hash}`); }, [hash]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setNote('Link copied.'); store.say('Link copied.'); }
    catch { input.current?.select(); setNote('Copying is blocked here — the link is selected, press Ctrl + C (⌘ C on a Mac).'); }
  };
  return (
    <div className={styles.copy}>
      <p className={styles.muted}>Your device has no share sheet in this browser, so here is the link.</p>
      <label htmlFor={id} className={styles.composerLabel}>Link</label>
      <div className={styles.copyRow}>
        <input ref={input} id={id} readOnly value={url} className={styles.copyInput} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className={styles.primaryBtn} onClick={() => void copy()}>Copy link</button>
      </div>
      <p className={styles.hint} aria-live="polite">{note}</p>
    </div>
  );
}

function Switch({ label, note, checked, onChange }: { label: string; note?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={styles.switch} onClick={() => onChange(!checked)}>
      <span className={styles.switchTrack} aria-hidden="true"><span className={styles.switchThumb} /></span>
      <span>{label}</span>
      {note ? <span className={styles.switchNote}>{note}</span> : null}
    </button>
  );
}

function ShareIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 15V4.5M8 8.500l4-4 4 4M5.500 12.500v6h13v-6" /></svg>;
}

