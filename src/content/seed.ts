import { ROOT_ID, type FsNode, type MimeType, type TextContent } from '../domain/fs/types';
import type { AppId } from '../shell/appIds';

/**
 * Seeded content for the fictional abandoned PC.
 * Canon: owner Aarav, files dated Aug 1998 – 31 Dec 1999 23:58. Nothing is dated 2000 or later.
 * All text is original fiction written for this project.
 */
export const SEED_VERSION = 1;

export const SEED_IDS = {
  root: ROOT_ID,
  docs: 'seed:docs',
  letters: 'seed:letters',
  pictures: 'seed:pictures',
  programs: 'seed:programs',
  accessories: 'seed:accessories',
  windows: 'seed:windows',
  secret: 'seed:secret',
  readme: 'seed:readme',
  checklist: 'seed:checklist',
  unsent: 'seed:unsent',
  plan: 'seed:plan',
  confession: 'seed:confession',
  school: 'seed:school',
  journal: 'seed:journal',
  grandma: 'seed:grandma',
  shopping: 'seed:shopping',
  syslog: 'seed:syslog',
  winini: 'seed:winini',
  finalFinal: 'seed:final-final',
  summer: 'seed:summer',
  room: 'seed:room',
} as const;

/** Trusted launch targets for seeded program files. User-created files can never launch apps. */
export const SEED_LAUNCHERS: Record<string, AppId> = {
  'seed:exe-notepad': 'notepad',
  'seed:exe-calc': 'calculator',
  'seed:exe-iexplore': 'browser',
  'seed:exe-command': 'terminal',
  'seed:exe-vault': 'vault',
  'seed:exe-explorer': 'explorer',
};

const READ_ME = `If you're reading this, the computer still works.

Please don't open y2k_checklist.txt. It is very embarrassing.
Also please don't open the letters folder. Or the Windows folder.
Actually just play Pinball or something.

- A, 1999

  _______________________________
 |  ___________________________  |
 | |                           | |
 | |   SYSADMIN-99 IS WATCHING  | |
 | |   (it is not. I made it    | |
 | |    in QBasic. - A)         | |
 | |___________________________| |
 |_______________________________|
      _[_______]_
  P.S. the password is NOT "password". I'm not stupid.
`;

const CHECKLIST = `Y2K EMERGENCY CHECKLIST  (v7 FINAL)
by Aarav, Class 9-B, Future Survivor
last edited: 31 Dec 1999

[x] 1. Save important files (all of them) (twice)
[x] 2. Buy 2 candles
[x] 3. Buy 1 more candle in case of candle bug
[x] 4. Tell the computer not to panic
[x] 5. Hide the floppy
[ ] 6. Definitely do NOT tell Riya why
[x] 7. Set SYSADMIN-99 Vault password to the exact moment
       the world ends. One word. ALL CAPS. (very secure)
[ ] 8. Learn to make fire (ask Dad) (do not ask Dad)
[x] 9. Water for 3 days, Maggi for 6 years
[ ] 10. Practise saying "I told you so" in a calm voice

Notes:
- Mom says "nothing will happen". That is EXACTLY what
  someone would say right before something happens.
- If the toaster has a chip, unplug toaster.
`;

const UNSENT = `To: riya_starlight@mailbox99.example
From: aarav_the_great_2000@mailbox99.example
Date: Fri, 31 Dec 1999 23:41
Subject: In case the year 2000 breaks everything
Status: NOT SENT (Outbox)

Riya,

If this arrives, I was right about the millennium bug and the
internet is somehow still working, which is also suspicious.

If it doesn't arrive, please check the secret folder.
(No, I am not being dramatic.)

It's on my computer. You can't see it. That's the point. It only
opens through the SYSADMIN-99 Vault (Start > Programs). The
password is on my checklist, which you also can't see. Security.

This is not a confession. Confessions are for people who are
not about to survive the apocalypse.

- Aarav

P.S. Please return my Hindi notebook. Page 14 has nothing on it.
`;

const PLAN = `=================================================
   SYSADMIN-99  //  OPERATION: MIDNIGHT FLOPPY
   CLASSIFICATION: TOP SECRET (do not tell Mom)
=================================================

OBJECTIVE
  Protect Floppy Disk #3 ("HINDI NOTES - BORING")
  from the Millennium Bug at all costs.

THE FLOPPY ACTUALLY CONTAINS
  A letter. To Riya. It says some things.
  Seventeen drafts. Draft 17 has a poem.
  The poem rhymes "Riya" with "pizza". It works if you say it fast.

PLAN
  23:55  Copy letter to floppy. Copy floppy to other floppy.
  23:57  Put floppy in steel tiffin box (Mom's) (borrowed).
  23:58  Shut down PC so the bug cannot find us.
  23:59  Hide under desk with candles 1, 2 and backup candle.
  00:00  Survive.
  00:01  If world still exists: send letter. Be brave.
  00:02  If world does not exist: no pressure. Perfect.

RISKS
  - World does not end and I have to actually send it.
  - (This is the main risk.)

>>> EXECUTING PROTOCOL...
`;

const CONFESSION = `(recovered from Floppy Disk #3, draft 17)

Dear Riya,

The year 2000 is coming and computers might stop working, so I
wanted to say this while the font still works.

You are the only person who laughed at my SYSADMIN-99 joke in
computer class. Nobody else got it. Mr. Iyer gave me detention.

I think you are cooler than a Pentium II with MMX.

  Roses are red, the server is down,
  I'd walk to your house, but you live across town.
  If the bug gets me and my files all go,
  at least now, Riya... you know.

From,
Aarav (the one with the floppy)

P.S. Pizza.
`;

const SCHOOL = `THE FUTURE OF COMPUTERS
by Aarav, 9-B  (Science project, due 15 Nov 1999)

In the future (2025) computers will be so fast that a webpage will
load in only 30 seconds. Everybody will have an email address, even
grandparents and maybe dogs.

Phones will have small games on them, like Snake but BETTER snake.

People will carry 1 GB of storage in their pocket, which is enough
for every song ever made, twice.

Robots will do homework. Teachers will not be able to tell.
(Ma'am if you are reading this, this is a joke.)

Biggest problem of the future: Y2K. If we survive Y2K, the future
will be easy and nothing bad or confusing will ever happen again.

Grade: B+  "Interesting predictions. See me about the robots."
`;

const JOURNAL = `JOURNAL - PRIVATE - THIS MEANS YOU, KABIR

14 Aug 1998
Got the computer!!! 233 MHz. 32 MB RAM. It makes a noise like a
tiny jet engine. I named it SYSADMIN-99 even though it is 1998.
I am ahead of my time.

02 Feb 1999
Riya said my screensaver was "kind of cool". Kind of. COOL.
Changed it to 3D pipes in her honour.

19 Jul 1999
Read about the Y2K bug. Computers think 2000 is 1900. That means
in 6 months my computer will think it is before computers were
invented and it will simply stop existing. I have started a list.

30 Dec 1999
Mom bought 40 packets of Maggi "because they were on sale".
She knows. Mothers always know.

31 Dec 1999, 23:58
It's time. Shutting down to hide from the bug.
If anyone finds this computer: the floppy is safe.
Tell Riya... actually don't tell Riya anything.
`;

const GRANDMA = `Dear Nani,

Thank you for the 101 rupees. I used it to buy candles.
Don't worry, it's for science.

If the computers stop working in the year 2000 I will write you
real letters again, which honestly I like more anyway.

Love,
Aarav
`;

const SHOPPING = `things for Y2K:
- candles (3)
- batteries (AA, AAA, the square one)
- floppy disks (box of 10)
- torch
- Maggi (Mom already bought 40)
- something to say to Riya (can you buy this?)
`;

const SYSLOG = `SYSADMIN-99 SYSTEM LOG  (c) 1999 Aarav Industries (not a real company)
-----------------------------------------------------------------
1999-12-31 23:00:00  Monitoring millennium... nominal.
1999-12-31 23:15:02  Toaster unplugged. Threat level reduced.
1999-12-31 23:30:44  User typed "am i overreacting" into Notepad. Deleted it.
1999-12-31 23:41:09  E-mail to RIYA saved to Outbox. Courage at 4%.
1999-12-31 23:41:10  Send button hovered for 11 minutes. Not clicked.
1999-12-31 23:55:00  Floppy #3 copied. Floppy #3 copied again.
1999-12-31 23:57:30  Floppy secured in tiffin box. Tiffin box smells of lemon rice.
1999-12-31 23:58:00  Hiding C:\\TOP_SECRET from the bug (and from Kabir).
1999-12-31 23:58:01  Vault password: [REDACTED - see checklist]
1999-12-31 23:58:02  SHUTTING DOWN. GOOD LUCK, SOLDIER.
`;

const WININI = `; for 16-bit app support
[windows]
load=
run=SYSADMIN99.EXE
Beep=yes
NullPort=None
device=Courage,winspool,NOT_FOUND

[Desktop]
Wallpaper=(None)
TileWallpaper=0
Pattern=Riya

[Y2K]
Ready=probably
`;

const FINAL_FINAL = `final_final_REAL_FINAL.txt

Dear Ma'am,

I could not submit my Hindi project because my computer has
contracted the Millennium Bug early, as a test run. It ate my
homework. Specifically the Hindi part. The maths part survived
because maths is stronger.

I have attached a floppy disk as proof. Please do NOT look at
floppy disk #3. That one is about something else.

Respectfully,
Aarav
(final version)
(final final version)
(ok this is it)
`;

type SeedSpec = {
  id: string;
  parentId: string | null;
  name: string;
  kind: FsNode['kind'];
  text?: string;
  mimeType?: MimeType;
  assetId?: string;
  createdAt: string;
  hidden?: boolean;
  readOnly?: boolean;
  system?: boolean;
  deleted?: boolean;
};

const SPECS: SeedSpec[] = [
  { id: SEED_IDS.root, parentId: null, name: 'C:', kind: 'drive', createdAt: '1998-08-14T10:00:00', system: true },
  { id: SEED_IDS.docs, parentId: SEED_IDS.root, name: 'My Documents', kind: 'folder', createdAt: '1998-08-14T10:05:00', system: true },
  { id: SEED_IDS.letters, parentId: SEED_IDS.docs, name: 'letters', kind: 'folder', createdAt: '1999-03-02T18:20:00' },
  { id: SEED_IDS.pictures, parentId: SEED_IDS.root, name: 'My Pictures', kind: 'folder', createdAt: '1998-08-14T10:05:00', system: true },
  { id: SEED_IDS.programs, parentId: SEED_IDS.root, name: 'Program Files', kind: 'folder', createdAt: '1998-08-14T10:00:00', system: true, readOnly: true },
  { id: SEED_IDS.accessories, parentId: SEED_IDS.programs, name: 'Accessories', kind: 'folder', createdAt: '1998-08-14T10:00:00', system: true, readOnly: true },
  { id: SEED_IDS.windows, parentId: SEED_IDS.root, name: 'Windows', kind: 'folder', createdAt: '1998-08-14T10:00:00', system: true, readOnly: true },
  { id: SEED_IDS.secret, parentId: SEED_IDS.root, name: 'TOP_SECRET', kind: 'folder', createdAt: '1999-12-31T23:58:00', hidden: true, system: true, readOnly: true },

  { id: SEED_IDS.readme, parentId: SEED_IDS.docs, name: 'Read Me First.txt', kind: 'file', text: READ_ME, createdAt: '1999-12-31T22:10:00', readOnly: true },
  { id: SEED_IDS.checklist, parentId: SEED_IDS.docs, name: 'y2k_checklist.txt', kind: 'file', text: CHECKLIST, createdAt: '1999-12-31T21:47:00', readOnly: true },
  { id: SEED_IDS.school, parentId: SEED_IDS.docs, name: 'school_project.txt', kind: 'file', text: SCHOOL, createdAt: '1999-11-14T20:12:00' },
  { id: SEED_IDS.journal, parentId: SEED_IDS.docs, name: 'journal.txt', kind: 'file', text: JOURNAL, createdAt: '1999-12-31T23:58:00' },
  { id: SEED_IDS.shopping, parentId: SEED_IDS.docs, name: 'shopping_list.txt', kind: 'file', text: SHOPPING, createdAt: '1999-12-28T17:03:00' },
  { id: SEED_IDS.finalFinal, parentId: SEED_IDS.docs, name: 'final_final_REAL_FINAL.txt', kind: 'file', text: FINAL_FINAL, createdAt: '1999-12-03T23:12:00', deleted: true },
  { id: SEED_IDS.unsent, parentId: SEED_IDS.letters, name: 'unsent_1999.txt', kind: 'file', text: UNSENT, createdAt: '1999-12-31T23:41:00', readOnly: true },
  { id: SEED_IDS.grandma, parentId: SEED_IDS.letters, name: 'to_nani.txt', kind: 'file', text: GRANDMA, createdAt: '1999-12-20T16:30:00' },

  { id: SEED_IDS.summer, parentId: SEED_IDS.pictures, name: 'summer_1999.bmp', kind: 'file', mimeType: 'image/svg', assetId: 'summer', createdAt: '1999-06-02T12:00:00', readOnly: true },
  { id: SEED_IDS.room, parentId: SEED_IDS.pictures, name: 'my_setup.bmp', kind: 'file', mimeType: 'image/svg', assetId: 'setup', createdAt: '1998-08-14T19:40:00', readOnly: true },

  { id: 'seed:exe-notepad', parentId: SEED_IDS.accessories, name: 'NOTEPAD.EXE', kind: 'file', mimeType: 'application/octet-stream', createdAt: '1998-05-11T20:01:00', readOnly: true },
  { id: 'seed:exe-calc', parentId: SEED_IDS.accessories, name: 'CALC.EXE', kind: 'file', mimeType: 'application/octet-stream', createdAt: '1998-05-11T20:01:00', readOnly: true },
  { id: 'seed:exe-iexplore', parentId: SEED_IDS.programs, name: 'IEXPLORE.EXE', kind: 'file', mimeType: 'application/octet-stream', createdAt: '1998-05-11T20:01:00', readOnly: true },
  { id: 'seed:exe-vault', parentId: SEED_IDS.programs, name: 'SYSADMIN99.EXE', kind: 'file', mimeType: 'application/octet-stream', createdAt: '1999-12-30T22:22:00', readOnly: true },
  { id: 'seed:exe-explorer', parentId: SEED_IDS.windows, name: 'EXPLORER.EXE', kind: 'file', mimeType: 'application/octet-stream', createdAt: '1998-05-11T20:01:00', readOnly: true },
  { id: 'seed:exe-command', parentId: SEED_IDS.windows, name: 'COMMAND.COM', kind: 'file', mimeType: 'application/octet-stream', createdAt: '1998-05-11T20:01:00', readOnly: true },
  { id: SEED_IDS.syslog, parentId: SEED_IDS.windows, name: 'SYSTEM_LOG.TXT', kind: 'file', text: SYSLOG, createdAt: '1999-12-31T23:58:02', readOnly: true },
  { id: SEED_IDS.winini, parentId: SEED_IDS.windows, name: 'WIN.INI', kind: 'file', text: WININI, createdAt: '1999-12-30T22:22:00', readOnly: true },

  { id: SEED_IDS.plan, parentId: SEED_IDS.secret, name: 'survival_plan.txt', kind: 'file', text: PLAN, createdAt: '1999-12-31T23:54:00', readOnly: true },
  { id: SEED_IDS.confession, parentId: SEED_IDS.secret, name: 'floppy3_draft17.txt', kind: 'file', text: CONFESSION, createdAt: '1999-12-31T23:55:00', readOnly: true },
];

const FAKE_BINARY_SIZES: Record<string, number> = {
  'seed:exe-notepad': 53248,
  'seed:exe-calc': 59392,
  'seed:exe-iexplore': 73216,
  'seed:exe-vault': 1999,
  'seed:exe-explorer': 241664,
  'seed:exe-command': 93890,
  'seed:summer': 38912,
  'seed:room': 30720,
};

export function buildSeed(): { nodes: FsNode[]; contents: TextContent[] } {
  const enc = new TextEncoder();
  const nodes: FsNode[] = [];
  const contents: TextContent[] = [];
  for (const s of SPECS) {
    const text = s.text;
    const node: FsNode = {
      id: s.id,
      parentId: s.parentId,
      name: s.name,
      kind: s.kind,
      sizeBytes: text !== undefined ? enc.encode(text).length : (FAKE_BINARY_SIZES[s.id] ?? 0),
      createdAt: s.createdAt,
      updatedAt: s.createdAt,
      revision: 1,
    };
    if (s.kind === 'file') node.mimeType = s.mimeType ?? 'text/plain';
    if (s.assetId) node.assetId = s.assetId;
    if (s.hidden) node.hidden = true;
    if (s.readOnly) node.readOnly = true;
    if (s.system) node.system = true;
    if (s.deleted) {
      node.deletedAt = '1999-12-03T23:13:00';
      node.originalParentId = s.parentId;
    }
    nodes.push(node);
    if (text !== undefined) contents.push({ nodeId: s.id, content: text });
  }
  return { nodes, contents };
}
