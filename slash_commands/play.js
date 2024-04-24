const { SlashCommandBuilder } = require('@discordjs/builders');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

module.exports = {
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

            connection.subscribe(player);
            player.play(resource);

            interaction.reply('Reproduciendo la canción en el canal de voz.');
        } catch (error) {
            console.error('Error al reproducir la canción:', error);
            interaction.reply('Hubo un error al reproducir la canción.');
        }
    },
};
