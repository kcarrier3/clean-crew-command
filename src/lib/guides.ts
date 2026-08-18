/**
 * In-app how-to guides. Content is authored here (versioned with the code) and
 * surfaced through the Help center, the contextual "?" button on each module,
 * and the first-time module tour.
 *
 * `audience` controls who sees a guide:
 *   'all'     - every signed-in user
 *   'manager' - managers, admins, and the owner only
 */
export type GuideAudience = 'all' | 'manager';

export interface GuideStep {
  title: string;
  body: string;
}

export interface GuideSection {
  heading: string;
  items: string[];
}

export interface ModuleGuide {
  /** Matches the module/nav key (see src/lib/modules.ts). */
  key: string;
  title: string;
  audience: GuideAudience;
  /** One-line description shown in the Help center list. */
  summary: string;
  /** Short walkthrough used by the first-time tour (3-5 steps). */
  tour: GuideStep[];
  /** Full reference content. */
  sections: GuideSection[];
  tips?: string[];
}

export const MODULE_GUIDES: ModuleGuide[] = [
  {
    key: 'dashboard',
    title: 'Dashboard',
    audience: 'all',
    summary: 'Your daily starting point: who is working, what needs attention, and quick reports.',
    tour: [
      { title: 'Start here every day', body: 'The dashboard shows the live picture of your operation: the shift roster for today, who is punched in, and anything that needs a decision.' },
      { title: 'Watch the shift roster', body: 'Scheduled shifts turn green when someone punches in, yellow when they are running late, and red as a no-show once they are 30+ minutes past their start time.' },
      { title: 'Run quick reports', body: 'The report buttons open account cost, pay period hours, and supply cost breakdowns without leaving the page.' },
      { title: 'Check notifications', body: 'The bell icon in the header shows work orders and alerts assigned to you specifically.' },
    ],
    sections: [
      {
        heading: 'What you see',
        items: [
          'Shift roster for the current day with live punch status.',
          'Currently clocked-in count, with names one tap away.',
          'Alerts for late punches, missed punches, and open work orders.',
        ],
      },
      {
        heading: 'Reports you can run',
        items: [
          'Account cost to run — labor from real punches plus supply usage per account.',
          'Pay period hours — hours by employee for the Sunday–Saturday pay period.',
          'Supply cost — what was consumed and where.',
        ],
      },
    ],
    tips: ['If a worker is excused for the day, use "Excuse missed shift" on the schedule so they are not flagged late or a no-show.'],
  },
  {
    key: 'scheduling',
    title: 'Schedule',
    audience: 'manager',
    summary: 'Build weekly schedules, publish them, cover call-offs, and manage open shifts.',
    tour: [
      { title: 'Pick your week', body: 'Use the week selector to move between weeks. Each row is an employee and each column is a day.' },
      { title: 'Add shifts', body: 'Click an empty cell to add a shift: choose the account, start and end time. Drag or edit to adjust.' },
      { title: 'Publish when ready', body: 'Drafts are only visible to managers. Publishing sends the schedule to employees and drives time clock auto-matching.' },
      { title: 'Handle call-offs', body: 'Click a shift on the day of service to record a call-off. The shift moves to the Open Shifts row and attendance points are recorded automatically.' },
      { title: 'Excuse a shift', body: 'Use "Give employee a day off on us" to excuse a shift — no late alerts, no missed-punch notifications, no attendance points.' },
    ],
    sections: [
      {
        heading: 'Core workflow',
        items: [
          'Build the week in draft, then publish so employees can see it.',
          'Open Shifts row holds uncovered work — assign it to anyone available.',
          'Copy a prior week when the schedule repeats to save time.',
        ],
      },
      {
        heading: 'Attendance rules it enforces',
        items: [
          'Call-off or missed punch: 2 points.',
          'Late punch more than 5 minutes: 0.5 points.',
          'Points reset quarterly; 8 points is the termination threshold.',
          'Excused shifts record no points and suppress alerts.',
        ],
      },
    ],
    tips: ['The time clock matches punches to the published schedule, so publish before the shift starts to get accurate account costing.'],
  },
  {
    key: 'myschedule',
    title: 'My Schedule',
    audience: 'all',
    summary: 'See your upcoming shifts, locations, and start times.',
    tour: [
      { title: 'Your shifts only', body: 'This shows the shifts assigned to you once your manager publishes the week.' },
      { title: 'Know where to go', body: 'Each shift lists the account and the scheduled start and end time. Tap for the address.' },
      { title: 'Punch in from the app', body: 'When your shift is close, the time clock will auto-select the right account for you.' },
    ],
    sections: [
      { heading: 'Good to know', items: [
        'Unpublished weeks will not appear yet — check back after your manager publishes.',
        'If a shift looks wrong, message your manager rather than skipping it.',
      ] },
    ],
  },
  {
    key: 'calendar',
    title: 'Calendar',
    audience: 'all',
    summary: 'Company-wide service calendar: customer visits, events, holidays, and notes.',
    tour: [
      { title: 'One shared calendar', body: 'Service visits, projects, company events, and paid holidays all appear here, color-coded by type.' },
      { title: 'Add an entry', body: 'Click a day to add an event, note, or holiday. Managers can also draft shifts directly on the calendar.' },
      { title: 'Switch views', body: 'Move between month and week to plan long-range or day-to-day.' },
    ],
    sections: [
      { heading: 'Entry types', items: [
        'Shift drafts — planned coverage before publishing.',
        'Events — walkthroughs, meetings, customer visits.',
        'Holidays — paid holidays that affect payroll.',
        'Notes — reminders that do not create work.',
      ] },
    ],
  },
  {
    key: 'managerlog',
    title: 'Manager Log',
    audience: 'manager',
    summary: 'Nightly reports from the field with photos and issues raised.',
    tour: [
      { title: 'Log the night', body: 'Managers submit an end-of-shift report covering what was completed and anything that needs follow-up.' },
      { title: 'Attach photos', body: 'Photos document conditions, damage, or completed work so nothing is disputed later.' },
      { title: 'Review history', body: 'Scroll back through prior nights by date and account to spot patterns.' },
    ],
    sections: [
      { heading: 'Use it for', items: [
        'Documenting recurring issues at an account before a customer complaint.',
        'Handing off open items between managers.',
        'Backing up billing conversations with dated evidence.',
      ] },
    ],
  },
  {
    key: 'jobsites',
    title: 'Accounts',
    audience: 'manager',
    summary: 'Create and manage recurring accounts and projects, budgets, and QR punch codes.',
    tour: [
      { title: 'Two job types', body: 'Recurring accounts are ongoing janitorial contracts. Projects are one-time or phased work with their own completion tracking.' },
      { title: 'Set the hour budget', body: 'Enter nightly allowed hours and the service frequency — the monthly budget auto-calculates from the actual service days each month.' },
      { title: 'Track cost to run', body: 'Labor from punches plus supply usage rolls up per account so you can see true cost against budget.' },
      { title: 'Post the QR code', body: 'Each account has a QR punch code employees can scan on site to clock in inside the geofence.' },
    ],
    sections: [
      { heading: 'Recurring accounts', items: [
        'Nightly hours + service days drive the monthly hour budget automatically.',
        'Budget reports flag accounts running over allowed hours.',
        'Contacts, billing preferences, and tax jurisdiction live on the account.',
      ] },
      { heading: 'Projects', items: [
        'Optionally split a project into phases.',
        'Crews press "project complete" or "phase complete" to signal the office it is ready to bill.',
        'T&M tickets add out-of-contract hours directly to the project budget.',
      ] },
    ],
    tips: ['Adding an account as recurring keeps it out of the Projects tab — pick the job type carefully at creation.'],
  },
  {
    key: 'billing',
    title: 'Billing',
    audience: 'manager',
    summary: 'Invoices, recurring billing, payments, check intake, and A/R aging.',
    tour: [
      { title: 'Ready to Bill', body: 'Completed projects and phases land here automatically so nothing goes unbilled.' },
      { title: 'Recurring invoicing', body: 'Run the monthly batch for janitorial accounts — every active recurring schedule generates its invoice in one pass.' },
      { title: 'Send by email', body: 'Invoices email to the billing contact on file, with delivery and open tracking logged on the invoice.' },
      { title: 'Receive checks', body: 'Photograph the check and stub; the system reads the amount and matches it to open invoices. Above the confidence threshold it can post automatically.' },
      { title: 'Watch A/R', body: 'The aging view breaks receivables into 30/60/90/120-day buckets.' },
    ],
    sections: [
      { heading: 'Invoice lifecycle', items: [
        'Draft → sent → partially paid → paid, with a full history log on each invoice.',
        'Sales tax resolves from the customer address (ZIP, then city, then state, then default).',
        'Bill-to and ship-to pull from the account and can be overridden per invoice.',
      ] },
      { heading: 'Payments', items: [
        'Record payments manually or through check intake.',
        'Deposit date defaults to the receipt date and can be changed.',
        'Payments allocate across one or more invoices.',
      ] },
    ],
    tips: ['Set the auto-post confidence threshold in Billing → Settings if scanned checks are posting too eagerly or not enough.'],
  },
  {
    key: 'quality',
    title: 'Quality Control',
    audience: 'manager',
    summary: 'Run inspections from templates, score accounts, and share results.',
    tour: [
      { title: 'Start from a template', body: 'Inspection templates define the checklist for an account type so every inspection is consistent.' },
      { title: 'Score each item', body: 'Walk the site, score each line, and attach photos where something needs attention.' },
      { title: 'Review the score', body: 'The overall score calculates automatically and history is kept per account so you can show trends to a customer.' },
    ],
    sections: [
      { heading: 'Best practice', items: [
        'Inspect on a regular cadence, not only after a complaint.',
        'Photograph deficiencies and completion — it settles disputes fast.',
        'Share improving scores with the customer during reviews.',
      ] },
    ],
  },
  {
    key: 'team',
    title: 'Team',
    audience: 'all',
    summary: 'Staff directory, employee records, payroll settings, and time-off review.',
    tour: [
      { title: 'Directory', body: 'Find coworkers and managers. Crew see the managers assigned to them; managers see the full staff directory.' },
      { title: 'Employee records', body: 'Managers manage job title, pay type and rate, hire date, and access permissions from the employee record.' },
      { title: 'Payroll & attendance', body: 'Stacked tabs cover schedule, payroll, attendance points, and time off for the selected employee.' },
      { title: 'Export payroll', body: 'The ADP Workforce Now export produces a payroll CSV for the pay period.' },
    ],
    sections: [
      { heading: 'Manager actions', items: [
        'Invite new employees by email; they complete their own profile on first login.',
        'Set job title — it drives default permissions and office punch eligibility.',
        'Review and approve time off; coverage limits and auto-approval rules apply.',
      ] },
      { heading: 'Permissions', items: [
        'Janitorial staff default to basic access: their schedule, time off, messaging.',
        'Managers get scheduling, accounts, quality, and reporting.',
        'Waypoint is limited to Owner, Office Manager, Sales Rep, and Admins.',
      ] },
    ],
  },
  {
    key: 'documents',
    title: 'Documents',
    audience: 'manager',
    summary: 'Build fillable PDFs, collect e-signatures, and manage onboarding packets.',
    tour: [
      { title: 'Upload a PDF', body: 'Start from any PDF — W-4, I-9, direct deposit, handbook acknowledgment, or your own form.' },
      { title: 'Place fields', body: 'Drag text, date, checkbox, and signature fields onto the page. Fields can auto-fill from the employee profile.' },
      { title: 'Assign and collect', body: 'Send the packet to an employee; they complete and sign it in the app and the signed copy is flattened and stored.' },
    ],
    sections: [
      { heading: 'Notes', items: [
        'Signed submissions lock and cannot be edited after signature.',
        'Onboarding packets can be assigned automatically to new hires.',
      ] },
    ],
  },
  {
    key: 'crm',
    title: 'Waypoint (CRM)',
    audience: 'manager',
    summary: 'Accounts, contacts, opportunities, quotes, and sales goals.',
    tour: [
      { title: 'Accounts and contacts', body: 'Every contact belongs to an account. Open an account to see its contacts, opportunities, notes, and files in one place.' },
      { title: 'Two pipelines', body: 'Opportunities are either Janitorial (recurring accounts) or Projects, each with its own pipeline and stages.' },
      { title: 'Work the opportunity', body: 'Open an opportunity for its own page: stage chevrons, value, owner, notes, files, and linked estimates.' },
      { title: 'Log losses properly', body: 'Marking an opportunity lost requires a reason; the Lost report then shows losses by 30/60/90/120 days.' },
      { title: 'Track against goal', body: 'The sales goal card on the Waypoint dashboard shows month and YTD actuals versus goals for janitorial and projects.' },
    ],
    sections: [
      { heading: 'Day-to-day', items: [
        'Opportunity value feeds the pipeline total — keep it current.',
        'The creator becomes the opportunity owner automatically.',
        'Scan a business card to create a contact and match it to an existing account.',
        'Merge duplicate accounts, move contacts between accounts, or merge opportunities.',
      ] },
      { heading: 'Access', items: [
        'Waypoint is visible only to the Owner, Office Manager, Sales Reps, and Admins.',
      ] },
    ],
  },
  {
    key: 'estimating',
    title: 'Estimating',
    audience: 'manager',
    summary: 'Build janitorial and construction-clean estimates and turn them into customer proposals.',
    tour: [
      { title: 'Attach to an opportunity', body: 'Every estimate belongs to a Waypoint opportunity so pricing stays tied to the deal.' },
      { title: 'Pick the service type', body: 'Janitorial uses production rates, minimum visit time, supervision and floor-care allowances. Construction uses a crew-day production model.' },
      { title: 'Review the cost cards', body: '"Cost to run project" shows labor and supplies. "Cost to customer" shows the line-by-line price including profit.' },
      { title: 'Send a proposal', body: 'Generate a customer-facing proposal PDF that hides your internal costs and wages.' },
      { title: 'Convert when awarded', body: 'An accepted proposal converts to an invoice, and a won estimate converts into a live account or project with its schedule.' },
    ],
    sections: [
      { heading: 'Construction cleaning', items: [
        'Crew-day model: 1 lead plus 4 members, 9.5 hours per day by default.',
        'Apartment baselines: 7,500 sq ft/day rough, 5,000 final, 1,000 touch-up.',
        'Rough, final, and touch-up price out as separate visible lines.',
        'Minimum day rate: $1,500 single-day, $1,250 on multi-day projects.',
        'Union/prevailing wage bids enforce a 41.25% minimum margin over crew-day labor cost.',
      ] },
      { heading: 'Janitorial', items: [
        'Production rates drive labor hours; override hours per visit when you know the real number.',
        'Supervision and periodic floor-care allowances apply as a percentage.',
      ] },
    ],
  },
  {
    key: 'supplies',
    title: 'Supplies',
    audience: 'all',
    summary: 'Inventory, stock levels, movements, requests, fixed assets, and cost reporting.',
    tour: [
      { title: 'Items vs. stock', body: 'Items are the catalog definitions (product, cost, markup). Stock is how many of each item sit at a location right now.' },
      { title: 'Move product', body: 'Record movements when supplies leave the warehouse, ride on a truck, or get delivered to an account. Stock updates automatically.' },
      { title: 'Requests', body: 'Crews request supplies from the app; supply staff fulfill from the requests tab.' },
      { title: 'Cost and billing reports', body: 'Cost report shows consumption per account. The billing report lists resale stock for the office manager to invoice.' },
    ],
    sections: [
      { heading: 'Managing the catalog', items: [
        'Each item carries a cost and a markup % for resale pricing.',
        'Cost changes are logged to a history trail so you can see price creep over time.',
        'Fixed assets (machines, equipment) are tracked separately from consumables.',
      ] },
      { heading: 'Who can do what', items: [
        'Anyone with manager access can adjust stock on hand.',
        'Supply managers and the owner can change markup and manage locations.',
      ] },
    ],
  },
  {
    key: 'messages',
    title: 'Messaging',
    audience: 'all',
    summary: 'Direct and group messaging with coworkers.',
    tour: [
      { title: 'Start a conversation', body: 'Message a coworker directly, or create a group for an account or project crew.' },
      { title: 'Stay notified', body: 'Unread counts appear on the messaging tab and push notifications reach you on the phone app.' },
    ],
    sections: [
      { heading: 'Notes', items: [
        'Crew can message managers and coworkers they share an account with.',
        'Announcements can be sent to a broad audience by managers.',
      ] },
    ],
  },
  {
    key: 'radio',
    title: 'Radio',
    audience: 'all',
    summary: 'Push-to-talk voice for crews punched in to the same account or project.',
    tour: [
      { title: 'Punch in first', body: 'The radio channel only opens for workers currently clocked in to the same account or project.' },
      { title: 'Hold to talk', body: 'Press and hold the button, speak, then release to send. Your clip plays for everyone on the channel.' },
      { title: 'Catch up', body: 'Recent transmissions stay available so someone who stepped away can play back what they missed.' },
    ],
    sections: [
      { heading: 'Notes', items: [
        'Clips are kept for 30 days.',
        'Punching out removes you from the channel automatically.',
      ] },
    ],
  },
  {
    key: 'timeoff',
    title: 'Time Off',
    audience: 'all',
    summary: 'Request time off and track PTO balances and paid holidays.',
    tour: [
      { title: 'Request time off', body: 'Pick your dates and submit. Requests inside the coverage limits can auto-approve; others go to your manager.' },
      { title: 'Check your balance', body: 'Your PTO card shows entitled, used, and remaining hours for your anniversary year.' },
      { title: 'Paid holidays', body: 'New Year\u2019s Day, Memorial Day, July 4th, Labor Day, Thanksgiving, and Christmas are paid when they fall on a day we work.' },
    ],
    sections: [
      { heading: 'Accrual', items: [
        '1 year of service: 1 week. 3 years: 2 weeks. 5 years: 3 weeks.',
        'Managers receive 2 weeks plus paid holidays.',
        'Full-time (35+ hour weekly average) accrues 40 hours per earned week.',
        'Part-time accrues on their real trailing 52-week average.',
      ] },
    ],
  },
  {
    key: 'contacts',
    title: 'Contacts',
    audience: 'all',
    summary: 'Company contact directory for vendors, customers, and internal numbers.',
    tour: [
      { title: 'Find a number fast', body: 'Search the directory by name or category to reach the right person.' },
      { title: 'Managers maintain it', body: 'Admins add and categorize entries so everyone works from the same list.' },
    ],
    sections: [
      { heading: 'Notes', items: ['Visibility can be limited by category so crew only see what they need.'] },
    ],
  },
  {
    key: 'onboarding',
    title: 'Onboarding & Docs',
    audience: 'all',
    summary: 'Complete your new-hire paperwork and view signed documents.',
    tour: [
      { title: 'Finish your packet', body: 'Assigned documents appear here — W-4, I-9, direct deposit, and any company forms.' },
      { title: 'Sign in the app', body: 'Fill the fields and sign on screen. Once signed, the document locks and is stored for you.' },
    ],
    sections: [
      { heading: 'Notes', items: ['Your profile must be complete before the rest of the app unlocks.'] },
    ],
  },
];

export const guideForModule = (key: string): ModuleGuide | undefined =>
  MODULE_GUIDES.find((g) => g.key === key);

export const guidesFor = (
  isManager: boolean,
  isModuleEnabled: (key: string) => boolean,
): ModuleGuide[] =>
  MODULE_GUIDES.filter(
    (g) =>
      (g.audience === 'all' || isManager) &&
      (g.key === 'dashboard' || isModuleEnabled(g.key)),
  );
