'use strict';
// Everything a viewer reads or sees as "content" lives here: brand, copy, crew, the app, footage slots.
// It is ALL ours or Manus's own: the film borrows the reference's motion (timing, cuts, camera, easing, blur, beats), never its
// words, characters, logos, layouts or pictures. Change a line here and re-render; scene files only lay it out.
// CUE VERSION (2026-10-22): the story is a Cue request. Claims to confirm with Manus before anything goes out: each agent has
// its own email and phone number; it only spends after you approve; a team of agents splits one job; the tagline and handle.
window.STORY = {
  brand: { name: 'Cue', sub: 'by Manus', tagline: 'Give it a cue.', handle: '@CueAgents' },

  // Manus's OFFICIAL files go here when the brand kit arrives (never redraw them): a path per agent id, the logo, the font.
  // Until then the six original crew characters (lib/cast.js) stand in.
  // Official files from the Cue app, shown exactly as supplied and only in logo positions (lockup mark, end card, app header):
  // logo = the Cue app icon; subLogo = Manus's hand mark. The agents in the film stay our own characters.
  brandArt: { cast: {}, logo: 'brand/cue/official/cue-icon.png', logoInset: 100 / 1024, subLogo: 'brand/cue/official/logo.webp', font: null },

  // the user's request, typed into the prompt bar (shot 03) and shown as the user's message in every chat
  prompt: 'Plan Saturday dinner for six.',

  crew: [   // id (the stand-in character), the agent's name and job, colour
    { id: 'scout', name: 'Research', role: 'Finds the options', tint: '#2E6BFF' },
    { id: 'critic', name: 'Reviews', role: 'Reads what people say', tint: '#FF7A1F' },
    { id: 'analyst', name: 'Planner', role: 'Weighs it all up', tint: '#8C7BD8' },
    { id: 'director', name: 'Organizer', role: 'Puts it on one page', tint: '#E0A15A' },
    { id: 'builder', name: 'Phone', role: 'Makes the calls', tint: '#19B47E' },
    { id: 'writer', name: 'Email', role: 'Sends the invites', tint: '#8B5CF6' },
  ],
  crewMore: 'Meet the whole team',

  // the app on the phones (stand-in screens until Manus's official Cue screens arrive)
  app: { name: 'Cue', line: 'Your day, handled.' },

  chat: {
    scout1: { agent: 'scout', status: 'Searching', reply: ['On it. Six people, Saturday at 7, close to home.', 'Checking who has a table...'] },
    scout2: { agent: 'scout', status: 'Searching', reply: ['Found 40 places with a table for six this', 'Saturday...'] },
    critic1: { agent: 'critic', status: 'Reading', reply: ['Reading 1,200 recent reviews so nobody ends up', 'next to the kitchen door.'] },
    research: { agent: 'scout', status: 'Comparing', head: 'Where should six friends eat?', sub: 'Open tables, real reviews, a short walk.',
      steps: ['Checking open tables.', 'Reading recent reviews.', 'Pricing the ride home.'] },
    bigType: ['Checking open tables...', 'Reading recent reviews...', 'Three places stand out.'],
    insights: { agent: 'analyst', status: 'Ranked', head: 'Three places fit all six of you.',
      sub: 'Quiet enough to talk, close enough to walk.',
      items: [['Lune', 'Table for six at 7 pm.'], ['Nori Bar', 'Private room at 7:30.'], ['Casa Verde', 'Terrace, no deposit.']] },
    plan: { agent: 'director', status: 'Drafted', head: 'Here’s your Saturday.', sub: 'Dinner, cake and rides, ready to approve.',
      doc: 'Saturday Plan', docKind: 'Doc · 1 page' },
    build: { agent: 'builder', status: 'Calling', head: 'Saturday is coming together.', lines: ['Table for six: held till 6 pm.', 'Cake: calling the bakery...'] },
    media: { agent: 'writer', status: 'Writing', head: 'Invites for all six.',
      lines: [['6', 'invites, written.'], ['1', 'cake, ordered.'], ['3', 'rides, booked.']], foot: 'Waiting on your approval.' },
  },

  promptPlaceholder: 'Give Cue a task',

  // the 3D fan of option screens (shot W5): caption + floating agent labels
  fan: { caption: 'Comparing 40 places nearby...', labels: [
    { agent: 'scout', text: 'Tables checked' }, { agent: 'critic', text: 'Reviews read' },
    { agent: 'analyst', text: 'Menus compared' }, { agent: 'director', text: 'Allergies noted' },
    { agent: 'builder', text: 'Rides priced' }, { agent: 'writer', text: 'Invites drafted' },
    { agent: 'scout', text: 'Bakeries called' } ] },

  // floating agent bubbles over pictures
  bubbles: {
    reviews: { agent: 'scout', text: 'Reading every recent review' },
    tagging: { agent: 'critic', text: '“Too loud” is complaint #1' },
    ship: { agent: 'director', text: 'Approve the $60 deposit?' },
    listeners: { agent: 'builder', text: 'Calling the bakery about the cake' },
  },

  // restaurant reviews (shot 05) and the friends' replies to the invite (shot 09): invented people, places and words
  reviews: [
    { who: 'Mara Lind', handle: '@maralind', stars: 5, text: 'Big table, great pasta, and they let us stay late.', show: 'Lune' },
    { who: 'Theo Park', handle: '@theopark', stars: 4, text: 'Lovely room, but we waited 40 minutes for a table.', show: 'Nori Bar' },
    { who: 'Ines Duarte', handle: '@inesd', stars: 5, text: 'Ask for the terrace. Best seat in the city.', show: 'Casa Verde' },
  ],
  replies: [
    { who: 'Priya Nair', text: 'I’m in! Saturday works.' },
    { who: 'Dev Kapoor', text: 'can we do 7:30?' },
    { who: 'Sol Reyes', text: 'Bringing my sister, is that ok?' },
    { who: 'June Okafor', text: 'No nuts for me please.' },
    { who: 'Ari Cohen', text: 'Who’s getting the cake?' },
    { who: 'Lena Voigt', text: 'Yes!! Finally.' },
  ],
  shows: ['Lune', 'Nori Bar', 'Casa Verde', 'Field & Fig', 'The Slow Table', 'Tidepool', 'Kitchen Twelve',
    'Second Plate', 'Low Light', 'Paper Lantern', 'Quiet Fork', 'Late Supper', 'Bright Salt', 'Common Table', 'Northside', 'Afterglow'],

  // footage slots: null = the original illustrated stand-in plate; a path (image or video) = real footage
  footage: { plate1: 'out/fal/v2/plate1-v2-fit.mp4', plate2: 'out/fal/v3/plate2-fit.mp4',
    carousel: ['out/fal/v3/car0-fit.mp4', 'out/fal/v3/car1-fit.mp4', 'out/fal/v3/car2-fit.mp4', 'out/fal/v3/car3-fit.mp4', 'out/fal/v3/car4-fit.mp4', 'out/fal/v3/car5-fit.mp4'] },
};
