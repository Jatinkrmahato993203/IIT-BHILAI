import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useOs } from '../../os/OsContext';
import type { AppProps } from '../../shell/appRegistry';
import { Modal } from '../../ui/Modal';
import { addressOf, HOME, resolveAddress, type Resolution, type Route } from './routes';

let dialedThisSession = false;

type Entry = { address: string; res: Resolution };

const SEARCH_INDEX: { words: string[]; route: Route; title: string; blurb: string }[] = [
  { words: ['y2k', 'millennium', 'bug', '2000', 'year'], route: 'y2k', title: 'Y2K WATCH — Is your toaster ready?', blurb: 'Countdown, survival tips and a very calm FAQ (not calm).' },
  { words: ['mail', 'email', 'inbox', 'outbox', 'letter'], route: 'mail', title: 'DialUp99 Mail — Check your e-mail', blurb: 'Log in to read your messages. You have 1 unsent message.' },
  { words: ['aarav', 'homepage', 'geopages', 'sysadmin'], route: 'aarav', title: "Aarav's Totally Awesome Homepage", blurb: 'Under construction since 1998. Best viewed at 800x600.' },
  { words: ['guestbook', 'sign'], route: 'guestbook', title: 'Sign my Guestbook!!!', blurb: 'Leave a message. Be nice. Kabir.' },
];

function Link({ to, children, go }: { to: string; children: ReactNode; go: (a: string) => void }) {
  return (
    <button className="web-link" onClick={() => go(to)}>
      {children}
    </button>
  );
}

function Page({ res, go }: { res: Resolution; go: (a: string) => void }) {
  const os = useOs();
  const [guest, setGuest] = useState<{ name: string; text: string }[]>([
    { name: 'Kabir', text: 'ur site is ok i guess. -K' },
    { name: 'Mom', text: 'Beta come for dinner. Also who is Riya?' },
  ]);
  const [gName, setGName] = useState('');
  const [gText, setGText] = useState('');
  const [openMail, setOpenMail] = useState<string | null>(null);
  const [q, setQ] = useState(res.kind === 'page' ? res.query : '');

  useEffect(() => {
    if (res.kind === 'page' && res.route === 'mail' && openMail === 'outbox-1') os.emit('clue.letter-read');
  }, [openMail, os, res]);

  if (res.kind === 'error') {
    if (res.reason === 'blocked')
      return (
        <div className="web-page web-error">
          <h2>This address type is not allowed</h2>
          <p>For your safety, this 1999 browser only opens pages that live on this computer. Nothing was run.</p>
          <p><Link to={addressOf(HOME)} go={go}>Go to the home page</Link></p>
        </div>
      );
    return (
      <div className="web-page web-error">
        <h2>The page cannot be displayed</h2>
        <p>The page you are looking for is currently unavailable. The modem is busy being dramatic.</p>
        <p className="small">{res.reason === 'offline' ? 'It is 31 December 1999 inside this computer. That website has not been invented yet, or the phone line is in use by Mom.' : 'HTTP 404 — File not found on this server.'}</p>
        <ul>
          <li>Check the address for typing mistakes (you typed: <code>{res.input}</code>)</li>
          <li><Link to={addressOf(HOME)} go={go}>Return to the home page</Link></li>
        </ul>
      </div>
    );
  }

  switch (res.route) {
    case 'home':
      return (
        <div className="web-page web-home">
          <h2 className="web-logo">DialUp99 <small>Your Gateway to the Information Superhighway!</small></h2>
          <div className="marquee" aria-hidden={os.reduceMotion ? undefined : true}><span>*** WELCOME TO THE WEB *** ONLY 1 DAY UNTIL THE YEAR 2000 *** HAVE YOU BACKED UP YOUR FLOPPIES? ***</span></div>
          <p className="visually-hidden">Welcome to the web. Only 1 day until the year 2000.</p>
          <table className="web-table"><tbody>
            <tr><td><Link to="retro://mail" go={go}>📧 Mail</Link></td><td>You have <b>1 unsent</b> message</td></tr>
            <tr><td><Link to="retro://search" go={go}>🔍 WebSeek99</Link></td><td>Search all 4 websites</td></tr>
            <tr><td><Link to="retro://y2k" go={go}>⏰ Y2K Watch</Link></td><td>Is the world ending? Find out!</td></tr>
            <tr><td><Link to="retro://aarav" go={go}>🏠 Aarav's Homepage</Link></td><td>Under construction</td></tr>
          </tbody></table>
          <p className="small">You are visitor number <span className="counter">000427</span>. Best viewed in 800x600 with 256 colours.</p>
        </div>
      );
    case 'search': {
      const term = res.query.trim().toLowerCase();
      const hits = term ? SEARCH_INDEX.filter((s) => s.words.some((w) => term.includes(w) || w.includes(term))) : [];
      return (
        <div className="web-page">
          <h2 className="web-logo">WebSeek99</h2>
          <form onSubmit={(e) => { e.preventDefault(); go(addressOf('search', q)); }} className="field-row">
            <label htmlFor="ws-q">Search:</label>
            <input id="ws-q" value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} />
            <button type="submit">Seek!</button>
          </form>
          {term && (
            <>
              <p className="small">Results for <b>{res.query}</b>:</p>
              {hits.length === 0 ? (
                term.includes('riya') ? <p>No results. Try being braver.</p> : <p>No results found. The internet is only 4 pages long in 1999.</p>
              ) : (
                <ol>{hits.map((h) => <li key={h.route}><Link to={addressOf(h.route)} go={go}>{h.title}</Link><br /><span className="small">{h.blurb}</span></li>)}</ol>
              )}
            </>
          )}
        </div>
      );
    }
    case 'mail': {
      const MAILS = [
        { id: 'in-1', box: 'Inbox', from: 'Mom', subject: 'dinner', date: '31 Dec 1999 20:02', body: 'Dinner is ready. It has been ready since 8. The computer will survive 10 minutes without you.\n\n- Mom\n\nP.S. Why is my tiffin box missing?' },
        { id: 'in-2', box: 'Inbox', from: 'riya_starlight', subject: 're: computer class', date: '17 Dec 1999 16:40', body: 'your SYSADMIN joke was actually funny lol. mr iyer has no sense of humour.\n\nalso u still have my hindi notebook.\n\n- R' },
        { id: 'in-3', box: 'Inbox', from: 'FREE-FLOPPIES', subject: 'YOU HAVE WON 1000 FREE FLOPPY DISKS!!!', date: '30 Dec 1999 03:13', body: 'CLICK HERE to claim. (There is nothing to click. It is 1999. Spam was simpler then.)' },
        { id: 'outbox-1', box: 'Outbox', from: 'aarav_the_great_2000 (unsent)', subject: 'In case the year 2000 breaks everything', date: '31 Dec 1999 23:41', body: "Riya,\n\nIf this arrives, I was right about the millennium bug.\nIf it doesn't arrive, please check the secret folder. (No, I am not being dramatic.)\n\nIt opens through the SYSADMIN-99 Vault (Start > Programs). The password is on my checklist. Security.\n\n- Aarav" },
      ];
      const open = MAILS.find((m) => m.id === openMail);
      return (
        <div className="web-page web-mail">
          <h2 className="web-logo">DialUp99 Mail <small>aarav_the_great_2000</small></h2>
          {open ? (
            <article aria-label={`Message: ${open.subject}`}>
              <p><b>From:</b> {open.from}<br /><b>Date:</b> {open.date}<br /><b>Subject:</b> {open.subject}{open.box === 'Outbox' && <><br /><b>Status:</b> NOT SENT</>}</p>
              <pre className="mail-body">{open.body}</pre>
              <button onClick={() => setOpenMail(null)}>« Back to folders</button>{' '}
              {open.box === 'Outbox' && <button onClick={() => void os.message({ title: 'DialUp99 Mail', icon: 'error', text: ['Send failed.', 'Error 1999: Sender lost courage. Message returned to Outbox.'] })}>Send</button>}
            </article>
          ) : (
            ['Inbox', 'Outbox'].map((box) => (
              <section key={box} aria-label={box}>
                <h3>{box} ({MAILS.filter((m) => m.box === box).length})</h3>
                <ul className="mail-list">
                  {MAILS.filter((m) => m.box === box).map((m) => (
                    <li key={m.id}><button className="web-link" onClick={() => setOpenMail(m.id)}>{m.from} — {m.subject}</button> <span className="small">{m.date}</span></li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      );
    }
    case 'guestbook':
      return (
        <div className="web-page">
          <h2 className="web-logo">Sign my Guestbook!!!</h2>
          <ul className="guestbook">{guest.map((g, i) => <li key={i}><b>{g.name}</b> wrote: {g.text}</li>)}</ul>
          <form onSubmit={(e) => { e.preventDefault(); if (!gText.trim()) return; setGuest((x) => [...x, { name: gName.trim().slice(0, 30) || 'Anonymous', text: gText.trim().slice(0, 200) }].slice(-30)); setGText(''); }}>
            <div className="field-row"><label htmlFor="gb-n">Name:</label><input id="gb-n" value={gName} maxLength={30} onChange={(e) => setGName(e.target.value)} /></div>
            <div className="field-row"><label htmlFor="gb-t">Message:</label><input id="gb-t" value={gText} maxLength={200} onChange={(e) => setGText(e.target.value)} /></div>
            <button type="submit">Sign</button>
          </form>
          <p className="small">Entries are kept only until you close the browser window.</p>
        </div>
      );
    case 'y2k':
      return (
        <div className="web-page web-y2k">
          <h2 className="web-logo">⏰ Y2K WATCH</h2>
          <p className="countdown" aria-label="Countdown: 0 days, 0 hours, 2 minutes">0 days : 0 hours : 2 minutes</p>
          <h3>FAQ</h3>
          <dl>
            <dt>Will my computer explode?</dt><dd>Experts say no. Aarav says "experts would say that".</dd>
            <dt>Should I unplug my toaster?</dt><dd>Only if it has feelings. Or a chip.</dd>
            <dt>What is the best time to tell someone how you feel?</dt><dd>Before midnight, apparently. Or after. Or never, if you are Aarav.</dd>
          </dl>
          <p><Link to="retro://home" go={go}>« Home</Link></p>
        </div>
      );
    case 'aarav':
      return (
        <div className="web-page web-aarav">
          <h2 className="web-logo rainbow">Aarav's Totally Awesome Homepage</h2>
          <p className="construction" role="img" aria-label="Under construction sign">🚧 UNDER CONSTRUCTION 🚧</p>
          <p>Hi! I am Aarav. I am 14. My computer is called SYSADMIN-99. Things I like: computers, QBasic, 3D Pipes screensaver, and [REDACTED].</p>
          <p>My Top 3 websites: <Link to="retro://y2k" go={go}>Y2K Watch</Link>, <Link to="retro://search" go={go}>WebSeek99</Link>, and this one.</p>
          <p><Link to="retro://guestbook" go={go}>Sign my guestbook!</Link></p>
          <p className="small">Webring: « Prev | Random | Next » (all links lead back here. it is a very small ring.)</p>
        </div>
      );
  }
}

export default function RetroBrowser({ windowId, args }: AppProps) {
  const os = useOs();
  const start = args.address ?? addressOf(HOME);
  const [hist, setHist] = useState<Entry[]>([{ address: start, res: resolveAddress(start) }]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState(start);
  const [dialing, setDialing] = useState(!dialedThisSession);
  const [dialStep, setDialStep] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const content = useRef<HTMLDivElement>(null);
  const cur = hist[idx];

  useEffect(() => {
    os.setTitle(windowId, `${cur.res.kind === 'page' ? cur.res.route.toUpperCase() : 'Cannot find server'} - The Internet`);
  }, [cur, os, windowId]);

  // New address argument (e.g. from Run dialog)
  const lastArg = useRef(args.address);
  useEffect(() => {
    if (args.address && args.address !== lastArg.current) {
      lastArg.current = args.address;
      go(args.address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.address]);

  useEffect(() => {
    if (!dialing) return;
    os.playSound('modem');
    const steps = os.reduceMotion ? [300] : [700, 1400, 2100];
    const timers = steps.map((t, i) => setTimeout(() => setDialStep(i + 1), t));
    return () => timers.forEach(clearTimeout);
  }, [dialing, os]);

  function go(address: string) {
    const res = resolveAddress(address);
    const canonical = res.kind === 'page' ? addressOf(res.route, res.query) : address;
    const next = [...hist.slice(0, idx + 1), { address: canonical, res }].slice(-50);
    setHist(next);
    setIdx(next.length - 1);
    setTyped(canonical);
    content.current?.scrollTo({ top: 0 });
  }
  const back = () => {
    if (idx === 0) return;
    setIdx(idx - 1);
    setTyped(hist[idx - 1].address);
  };
  const fwd = () => {
    if (idx >= hist.length - 1) return;
    setIdx(idx + 1);
    setTyped(hist[idx + 1].address);
  };
  const finishDial = () => {
    dialedThisSession = true;
    setDialing(false);
  };
  const connected = dialStep >= (os.reduceMotion ? 1 : 3);

  return (
    <div className="app browser">
      <div className="toolbar" role="toolbar" aria-label="Navigation">
        <button onClick={back} disabled={idx === 0}>◄ Back</button>
        <button onClick={fwd} disabled={idx >= hist.length - 1}>Forward ►</button>
        <button onClick={() => setRefreshKey((k) => k + 1)}>Refresh</button>
        <button onClick={() => go(addressOf(HOME))}>Home</button>
      </div>
      <form className="addressbar" onSubmit={(e) => { e.preventDefault(); go(typed); }}>
        <label htmlFor={`${windowId}-url`}>Address</label>
        <input id={`${windowId}-url`} value={typed} maxLength={300} spellCheck={false} onChange={(e) => setTyped(e.target.value)} data-autofocus="true" />
        <button type="submit">Go</button>
      </form>
      <div className="web-content sunken-panel" ref={content}>
        <Page key={`${idx}-${refreshKey}`} res={cur.res} go={go} />
      </div>
      <div className="status-bar">
        <p className="status-bar-field">{dialing ? 'Connecting...' : 'Done'}</p>
        <p className="status-bar-field">Internet zone (local only)</p>
      </div>
      {dialing && (
        <Modal
          title="Dial-up Networking"
          scope="window"
          icon="globe"
          cancelValue="skip"
          buttons={[{ label: connected ? 'OK' : 'Skip', value: 'skip', primary: true }]}
          onResult={finishDial}
        >
          <p role="status">
            {connected
              ? 'Connected at 56 Kbps. Estimated emotional download: 14 years.'
              : ['Dialing 1-800-DIALUP99...', 'Verifying user name and password...', 'Logging on to network...'][Math.min(dialStep, 2)]}
          </p>
          <p className="small">(Simulated. No real connection is made.)</p>
        </Modal>
      )}
    </div>
  );
}
