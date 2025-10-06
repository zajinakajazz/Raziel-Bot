import {
  Client, GatewayIntentBits, Partials, Events,
  REST, Routes, SlashCommandBuilder, EmbedBuilder
} from 'discord.js';

// ======= ENV =======
const TOKEN = process.env.DISCORD_TOKEN;
const OPENAI = process.env.OPENAI_API_KEY;
const GUILD_ID = process.env.GUILD_ID || null;
if (!TOKEN) { console.error('❌ Missing DISCORD_TOKEN'); process.exit(1); }

// ======= CLIENT =======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,   // <-- enables normal chat
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// ======= SIMPLE IN-MEMORY AGENDA =======
const agenda = []; // {id,title,dueTs,channelId,roleId?,warn10?,warn0?}
const pad = n => String(n).padStart(2,'0');
const fmt = ts => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const parseDue = (s) => {
  // expects "YYYY-MM-DD HH:mm" 24h
  const iso = s.trim().replace(' ', 'T') + ':00';
  const ts = Date.parse(iso);
  return Number.isNaN(ts) ? null : ts;
};
const listAgenda = (scope='today') => {
  const t = new Date(); t.setHours(0,0,0,0);
  const start = t.getTime();
  const endDay = start + 24*60*60*1000;
  const endWeek = start + 7*24*60*60*1000;
  return agenda
    .filter(it => scope==='all'
      ? true
      : scope==='week' ? (it.dueTs >= start && it.dueTs < endWeek)
      : (it.dueTs >= start && it.dueTs < endDay))
    .sort((a,b)=>a.dueTs-b.dueTs);
};

// ======= OPENAI HELPER =======
async function think(prompt) {
  if (!OPENAI) return "I don’t have my OPENAI_API_KEY yet. Please add it in Railway Variables.";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are Raziel, AI Producer & Secretary for Clover4Media. Be concise, decisive, and proactive. " +
            "When the user shares goals or deadlines, propose a short plan with bullet points and suggest agenda items. " +
            "If you suggest agenda, format each line like: [agenda] Title | YYYY-MM-DD HH:mm"
        },
        { role: "user", content: prompt }
      ]
    })
  }).catch(() => null);
  if (!res) return "Network error reaching my planning service.";
  const data = await res.json().catch(()=>null);
  return data?.choices?.[0]?.message?.content || "I’m ready, but I didn’t get a response.";
}

// ======= SLASH COMMANDS =======
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Health check'),
  new SlashCommandBuilder().setName('hello').setDescription('Say hello'),
  new SlashCommandBuilder().setName('status').setDescription('Show today’s agenda'),
  new SlashCommandBuilder().setName('agenda').setDescription('Manage agenda')
    .addSubcommand(s => s.setName('add').setDescription('Add an agenda item')
      .addStringOption(o => o.setName('title').setDescription('Title').setRequired(true))
      .addStringOption(o => o.setName('due').setDescription('YYYY-MM-DD HH:mm').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List agenda')
      .addStringOption(o => o.setName('scope').setDescription('today/week/all')
        .addChoices({name:'today',value:'today'},{name:'week',value:'week'},{name:'all',value:'all'})))
].map(c=>c.toJSON());

// ======= READY: REGISTER COMMANDS =======
client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Raziel online as ${c.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(c.user.id, GUILD_ID), { body: commands });
      console.log('Slash commands registered for guild:', GUILD_ID);
    } else {
      await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
      console.log('Slash commands registered globally');
    }
  } catch (err) { console.error('Command registration error:', err); }
});

// ======= INTERACTIONS (SLASH) =======
client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === 'ping') return i.reply('Pong! 🧠');
  if (i.commandName === 'hello') return i.reply(`Hello, ${i.user.username}. Ready to coordinate.`);
  if (i.commandName === 'status') {
    const items = listAgenda('today');
    const lines = items.length ? items.map(x=>`• **${x.title}** — ${fmt(x.dueTs)}`) : ['No items today.'];
    return i.reply(lines.join('\n'));
  }
  if (i.commandName === 'agenda') {
    const sub = i.options.getSubcommand();
    if (sub === 'add') {
      const title = i.options.getString('title', true);
      const dueStr = i.options.getString('due', true);
      const dueTs = parseDue(dueStr);
      if (!dueTs) return i.reply({ content: 'Use `YYYY-MM-DD HH:mm` (24h).', ephemeral: true });
      agenda.push({ id: `${Date.now()}`, title, dueTs, channelId: i.channelId });
      return i.reply(`✅ Added **${title}** — due **${fmt(dueTs)}**`);
    }
    if (sub === 'list') {
      const scope = i.options.getString('scope') ?? 'today';
      const items = listAgenda(scope);
      const lines = items.length ? items.map(x=>`• **${x.title}** — ${fmt(x.dueTs)}`) : [`No items for **${scope}**.`];
      return i.reply(lines.join('\n'));
    }
  }
});

// ======= NORMAL CHAT (@mention Raziel) =======
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  const mentioned = msg.mentions.has(client.user);
  if (!mentioned) return;

  // Strip the mention
  const cleaned = msg.content.replace(new RegExp(`^<@!?${client.user.id}>\\s*`), '').trim();
  if (!cleaned) return msg.reply('I’m listening. Share your goals/agenda and I’ll draft a plan.');

  // Quick agenda capture pattern (optional, no AI needed)
  // Example: "@Raziel add agenda: Lighting v1 due: 2025-10-12 14:00"
  const m = cleaned.match(/add\s+agenda:\s*(.+?)\s+due:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/i);
  if (m) {
    const title = m[1].trim();
    const dueTs = parseDue(m[2]);
    if (!dueTs) return msg.reply('Couldn’t parse the date. Use `YYYY-MM-DD HH:mm` (24h).');
    agenda.push({ id: `${Date.now()}`, title, dueTs, channelId: msg.channelId });
    return msg.reply(`✅ Added **${title}** — due **${fmt(dueTs)}**`);
  }

  // Otherwise, think about the “big picture”
  const plan = await think(
    `Server: ${msg.guild?.name || 'DM'} | Channel: ${msg.channel?.name}\n` +
    `User: ${msg.author.username}\n` +
    `Message:\n${cleaned}\n\n` +
    `Respond with a short plan. If you propose agenda items, also include lines like:\n[agenda] Task title | YYYY-MM-DD HH:mm`
  );

  // If AI suggests [agenda] lines, add them automatically
  const agendaLines = [];
  for (const line of plan.split('\n')) {
    const ma = line.match(/^\[agenda\]\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})$/i);
    if (ma) {
      const title = ma[1].trim();
      const dueTs = parseDue(ma[2]);
      if (dueTs) {
        agenda.push({ id: `${Date.now()}-${Math.random()}`, title, dueTs, channelId: msg.channelId });
        agendaLines.push(`• **${title}** — ${fmt(dueTs)} (added)`);
      }
    }
  }

  const tail = agendaLines.length
    ? `\n\n🗓️ I added:\n${agendaLines.join('\n')}\n(Use /agenda list to view.)`
    : '';
  await msg.reply(`${plan}${tail}`);
});

client.login(TOKEN);
