const { SlashCommandBuilder } = require('@discordjs/builders');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
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
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            const stream = ytdl(url, { filter: 'audioonly' });
            const resource = createAudioResource(stream);

            const player = createAudioPlayer();
            player.play(resource);

            // Manejar eventos de cierre y error del stream
            stream.on('end', () => {
                connection.destroy(); // Destruir la conexión una vez que la canción termina
            });

            stream.on('error', error => {
                console.error('Error en el stream de reproducción:', error);
                interaction.reply('Hubo un error al reproducir la canción.');
                connection.destroy(); // Destruir la conexión en caso de error
            });

            connection.subscribe(player);

            interaction.reply('Reproduciendo la canción en el canal de voz.');
        } catch (error) {
            console.error('Error al reproducir la canción:', error);
            interaction.reply('Hubo un error al reproducir la canción.');
        }
    },
};

client.commands.set('play', commandPlay);

client.login(CLIENT_TOKEN);
