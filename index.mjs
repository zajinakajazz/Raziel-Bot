import { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// --- Load token from environment variable ---
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("❌ Missing DISCORD_TOKEN env var. Set it in Railway → Variables.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// --- Simple in-memory store (for /todo & /remind demo) ---
const memory = {
  todos: [], // {text, userId, createdAt}
};

client.once('ready', async () => {
  console.log(`✅ Raziel online as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'Clover4Media production flow' }],
    status: 'online'
  });

  // Register global slash commands on boot (simple approach)
  try {
    const commands = [
      new SlashCommandBuilder().setName('ping').setDescription('Check if Raziel is alive'),
      new SlashCommandBuilder().setName('hello').setDescription('Greet Master Jazz'),
      new SlashCommandBuilder().setName('todo')
        .setDescription('Add or list tasks')
        .addSubcommand(s => s.setName('add').setDescription('Add a task')
          .addStringOption(o => o.setName('text').setDescription('Task details').setRequired(true)))
        .addSubcommand(s => s.setName('list').setDescription('List tasks')),
      new SlashCommandBuilder().setName('status')
        .setDescription('Post a quick studio status from open todos')
    ].map(c => c.toJSON());

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('🛠️ Slash commands registered.');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
});

client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return;

  // --- /ping
  if (i.commandName === 'ping') {
    return i.reply({ content: '🏓 Raziel is awake and ready.' });
  }

  // --- /hello
  if (i.commandName === 'hello') {
    return i.reply({ content: `Hello, Master Jazz. Raziel reporting for production.` });
  }

  // --- /todo add | /todo list
  if (i.commandName === 'todo') {
    const sub = i.options.getSubcommand();
    if (sub === 'add') {
      const text = i.options.getString('text', true);
      memory.todos.push({ text, userId: i.user.id, createdAt: Date.now() });
      return i.reply({ content: `✅ Added: **${text}**` });
    } else if (sub === 'list') {
      const lines = memory.todos.length ? memory.todos.map(t => `• ${t.text}`) : ['No tasks yet.'];
      return i.reply({ content: lines.join('\n') });
    }
  }

  // --- /status
  if (i.commandName === 'status') {
    const todoLines = memory.todos.slice(-20).map((t) => `• ${t.text}`);
    const embed = new EmbedBuilder()
      .setTitle('📋 Studio Status')
      .setDescription(todoLines.length ? todoLines.join('\n') : 'No open tasks.')
      .setFooter({ text: 'Raziel — AI Producer' });
    return i.reply({ embeds: [embed] });
  }
});

client.login(TOKEN);