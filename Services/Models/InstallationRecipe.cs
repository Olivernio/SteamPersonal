using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace SteamPersonal.Services.Models
{
    public class InstallationRecipe
    {
        [JsonPropertyName("game_id")]
        public string GameId { get; set; } = string.Empty;

        [JsonPropertyName("steam_appid")]
        public long SteamAppId { get; set; }

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("latest_official_version")]
        public string LatestOfficialVersion { get; set; } = "1.0.0";

        [JsonPropertyName("executable_relative_path")]
        public string ExecutableRelativePath { get; set; } = string.Empty;

        [JsonPropertyName("installation_recipe")]
        public List<RecipeStep> Steps { get; set; } = new();
    }

    public class RecipeStep
    {
        [JsonPropertyName("action")]
        public string Action { get; set; } = string.Empty;
        // Actions: "stream_extract" | "apply_crack" | "add_defender_exclusion" | "create_shortcut"

        [JsonPropertyName("provider")]
        public string? Provider { get; set; } // e.g. "GoogleDrive"

        [JsonPropertyName("url")]
        public string? Url { get; set; }

        [JsonPropertyName("source_folder")]
        public string? SourceFolder { get; set; }

        [JsonPropertyName("target_folder")]
        public string? TargetFolder { get; set; }

        [JsonPropertyName("path")]
        public string? Path { get; set; }

        [JsonPropertyName("shortcut_name")]
        public string? ShortcutName { get; set; }
    }

    public class RecipeStepProgressEventArgs : System.EventArgs
    {
        public int StepIndex { get; set; }
        public int TotalSteps { get; set; }
        public string Action { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = "running"; // "running" | "completed" | "failed"
    }
}
