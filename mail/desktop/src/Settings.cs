using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Ryvoki.Mail;

/// <summary>Stored in %AppData%\Ryvoki Mail\settings.json. The token is encrypted with Windows DPAPI for this user only.</summary>
public sealed class Settings
{
    private static readonly string Directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Ryvoki Mail");
    private static readonly string FilePath = Path.Combine(Directory, "settings.json");
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public string ServerUrl { get; set; } = "https://mail-api.ryvoki.com";
    public string TokenProtected { get; set; } = "";
    public string FromName { get; set; } = "Ryvoki";
    public string DefaultFrom { get; set; } = "business@ryvoki.com";
    public string Signature { get; set; } = "\n\n— Ryvoki\nryvoki.com";
    public int PollSeconds { get; set; } = 60;
    public bool LoadRemoteImages { get; set; }
    public int WindowWidth { get; set; } = 1240;
    public int WindowHeight { get; set; } = 780;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ServerUrl) && !string.IsNullOrWhiteSpace(TokenProtected);

    public string Token
    {
        get
        {
            if (string.IsNullOrWhiteSpace(TokenProtected)) return "";
            try
            {
                var bytes = ProtectedData.Unprotect(Convert.FromBase64String(TokenProtected), null, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(bytes);
            }
            catch
            {
                return "";
            }
        }
        set
        {
            TokenProtected = string.IsNullOrWhiteSpace(value)
                ? ""
                : Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(value.Trim()), null, DataProtectionScope.CurrentUser));
        }
    }

    public static Settings Load()
    {
        try
        {
            if (File.Exists(FilePath))
            {
                return JsonSerializer.Deserialize<Settings>(File.ReadAllText(FilePath), Json) ?? new Settings();
            }
        }
        catch
        {
            // Unreadable settings: start fresh, the setup screen will ask again.
        }
        return new Settings();
    }

    public void Save()
    {
        System.IO.Directory.CreateDirectory(Directory);
        var temporary = FilePath + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(this, Json));
        File.Move(temporary, FilePath, overwrite: true);
    }
}
