const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wall-delete")
    .setDescription("Supprimer un message du mur par son ID (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName("id")
        .setDescription("ID Discord du message (visible sur le mur)")
        .setRequired(true),
    ),
  async execute(interaction) {
    const raw = interaction.options.getString("id").replace(/^#/, "");
    const seq = parseInt(raw, 10);
    const result = isNaN(seq)
      ? { changes: 0 }
      : db.prepare("DELETE FROM wall_messages WHERE rowid = ?").run(seq);
    if (result.changes > 0) {
      await interaction.reply({
        content: `✅ Message \`#${seq}\` supprimé du mur.`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `❌ Aucun message avec le numéro \`#${raw}\` trouvé dans le mur.`,
        ephemeral: true,
      });
    }
  },
};
