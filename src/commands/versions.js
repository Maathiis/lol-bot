const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("versions")
    .setDescription("Voir la version actuelle du bot et ses nouveautés")
    .addStringOption((option) =>
      option
        .setName("version")
        .setDescription("Voir une version spécifique")
        .addChoices(
          { name: "V2.0.0 (Actuelle)", value: "2.0.0" },
          { name: "V1.0.0", value: "1.0.0" },
        ),
    ),
  async execute(interaction) {
    const selectedVersion = interaction.options.getString("version") || "2.0.0";

    const V2_0_0_FEATURES =
      "📁 **Clean DB Architecture** : Migration vers un schéma plus performant et lisible.\n" +
      "💀 **Death Monitoring** : Suivi précis du temps passé mort (Total & Mensuel).\n" +
      "🔗 **Discord Consolidation** : Fusion des stats et badges pour les multi-comptes.\n" +
      "🔄 **Global Streak Reset** : Une victoire sur n'importe quel compte reset la série Discord.\n" +
      "🎖️ **Nouveaux Badges** : Voir section badges.\n" +
      "🛠️ **Admin Refinement** : Commandes simplifiées et gestion par compte LoL.";

    const V2_0_0_COMMANDS =
      "📊 `/stats`, `/stats-month`, `/stats-server` : Refonte complète avec temps de mort.\n" +
      "🔴 `/live` : Voir qui est actuellement en train de perdre en temps réel.\n";

    const V2_0_0_BADGES =
      "🥉 **Le Grand Saut** : Rétrograder dans un palier inférieur.\n" +
      "🥈 **Banquier de l'Abîme** : Perdre un ARAM avec 3000+ golds en poche.\n" +
      "🥈 **Tir aux Pigeons** : Toucher 15+ boules de neige dans un ARAM et perdre.\n" +
      "🥈 **Le Mineur de Fond** : Passer la partie sans jamais croiser d'ennemi.\n" +
      "🥈 **Le Périphérique** : Faire le tour de la map sans participer aux combats.\n" +
      "🥈 **Écran Noir & Blanc** : Passer plus de 5 min mort cumulées.\n" +
      "🥈 **Le Banquier Inutile** : Perdre avec 3000+ golds non dépensés (Ranked).\n" +
      "🥈 **Smite de Panique** : Se faire voler un objectif avec le Smite dispo.\n" +
      "🥇 **Syndrome d'Icare** : Perdre avec 4000 golds d'avance sur son vis-à-vis.\n" +
      "🥇 **Top Gap des Enfers** : Perdre avec un inhibiteur et 3+ tours pris par le Top adverse.\n" +
      "🥇 **L'Assurance Vie** : Perdre avec un GA ou une Stopwatch en inventaire.\n" +
      "🥇 **Punching Ball** : Subir plus de 50 000 dégâts dans un ARAM et perdre.\n" +
      "💎 **Maître de la Défaite (V1)** : Obtenir tous les badges de la Gen 1.\n" +
      "🤫 + 5 nouveaux badges secrets !";

    const V1_0_0_FEATURES =
      "- 🚀 Refonte complète de l'architecture du bot.\n" +
      "- ✨ Nouveau système de badges avec 3 rangs de rareté (Bronze 🥉, Argent 🥈, Or 🥇).\n" +
      "- 📊 Les statistiques et les badges sont maintenant fusionnés par compte Discord (gère le multicomptes).\n" +
      "- 📅 Nouveau système de classement mensuel des défaites.\n" +
      "- ⚙️ Nouvelles commandes de gestion et ajout d'un système de sauvegarde.";

    const embed = new EmbedBuilder().setColor(0x00ff00).setTimestamp();

    if (selectedVersion === "2.0.0") {
      embed
        .setTitle("🆙 Version 2.0.0 - Clean & Multi-Account")
        .setDescription(
          "La refonte majeure pour une gestion parfaite des joueurs.",
        )
        .addFields(
          { name: "✨ Nouveautés", value: V2_0_0_FEATURES },
          { name: "🎮 Commandes", value: V2_0_0_COMMANDS },
          { name: "🎖️ Nouveaux Badges", value: V2_0_0_BADGES },
        )
        .setFooter({ text: "Bot LoL - Version 2.0.0" });
    } else {
      embed
        .setTitle("📌 Version 1.0.0 - Origins")
        .setDescription("Les bases du bot.")
        .addFields({ name: "✨ Fonctionnalités", value: V1_0_0_FEATURES })
        .setFooter({ text: "Bot LoL - Version 1.0.0" });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
