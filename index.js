const { SlashCommandBuilder } = require('@discordjs/builders');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const { Client, GatewayIntentBits } = require('discord.js');
const { CLIENT_TOKEN } = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Map();
client.connections = new Map();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
    }
});

const commandPlay = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Reproduce una canción de YouTube en el canal de voz.')
        .addStringOption(option =>
            option.setName('link')
                .setDescription('El enlace de YouTube de la canción.')
                .setRequired(true)),

    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply('Debes estar en un canal de voz para reproducir música.');
        }

        const url = interaction.options.getString('link');
        if (!ytdl.validateURL(url)) {
            return interaction.reply('El enlace proporcionado no es válido.');
        }

        try {
            let connection = client.connections.get(interaction.guild.id);
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                });
                client.connections.set(interaction.guild.id, connection);
            }

            const stream = ytdl(url, {
                filter: 'audioonly',
                quality: 'highestaudio', // Intentar mantener la mejor calidad de audio
                highWaterMark: 1 << 25 // Ajustar el highWaterMark para evitar cortes
            });
            const resource = createAudioResource(stream);

            const player = createAudioPlayer();
            player.play(resource);

            connection.subscribe(player);

            interaction.reply('Reproduciendo la canción en el canal de voz.');

            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
                client.connections.delete(interaction.guild.id);
            });
        } catch (error) {
            console.error('Error al reproducir la canción:', error);
            interaction.reply('Hubo un error al reproducir la canción.');
        }
    },
};


const commandSkip = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Omite la canción actual y pasa a la siguiente en la cola.'),

    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply('Debes estar en un canal de voz para omitir la canción.');
        }

        const connection = client.connections.get(interaction.guild.id);
        if (!connection) {
            return interaction.reply('El bot no está reproduciendo música en este servidor.');
        }

        const queue = interaction.client.queue || [];
        interaction.client.queue = queue;
        const currentSong = queue[0];

        if (!currentSong) {
            return interaction.reply('No hay canciones en cola para omitir.');
        }

        try {
            const stream = ytdl(currentSong.url, { filter: 'audioonly' });
            const resource = createAudioResource(stream);

            connection.player.play(resource); // Usar el reproductor existente

            interaction.reply('Canción omitida.');
        } catch (error) {
            console.error('Error al omitir la canción:', error);
            interaction.reply('Hubo un error al omitir la canción.');
        }
    },
};


client.commands.set('skip', commandSkip);
client.commands.set('play', commandPlay);

client.login(CLIENT_TOKEN);
