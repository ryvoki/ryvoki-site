using Ryvoki.Mail.Ui;

namespace Ryvoki.Mail;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        // Test harness: "--snapshot out.png --server http://127.0.0.1:8790 --token X" renders the main window to a PNG and exits.
        var snapshot = ArgValue(args, "--snapshot");
        if (snapshot is not null)
        {
            var testSettings = new Settings { ServerUrl = ArgValue(args, "--server") ?? "http://127.0.0.1:8790" };
            testSettings.Token = ArgValue(args, "--token") ?? "dev-mail-token";
            Application.Run(new MainForm(testSettings, snapshotPath: Path.GetFullPath(snapshot)));
            return;
        }

        // Diagnostics: "--print-settings" reports what the app finds at startup, without opening a window.
        if (Array.IndexOf(args, "--print-settings") >= 0)
        {
            var s = Settings.Load();
            var report = $"file: {Settings.Location}\nexists: {File.Exists(Settings.Location)}\nload error: {(Settings.LoadError == "" ? "none" : Settings.LoadError)}\nserver: {s.ServerUrl}\nconfigured: {s.IsConfigured}\ntoken decrypts: {(s.Token.Length > 0 ? "yes (" + s.Token.Length + " chars)" : "NO")}";
            File.WriteAllText(Path.Combine(Path.GetTempPath(), "ryvoki-mail-settings-check.txt"), report);
            return;
        }

        using var singleInstance = new Mutex(initiallyOwned: true, name: @"Local\RyvokiMail", createdNew: out var isFirst);
        if (!isFirst)
        {
            MessageBox.Show("Ryvoki Mail is already running.", "Ryvoki Mail", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        var settings = Settings.Load();
        if (!settings.IsConfigured)
        {
            using var setup = new SetupForm(settings);
            if (setup.ShowDialog() != DialogResult.OK)
            {
                return;
            }
        }

        Application.Run(new MainForm(settings));
    }

    private static string? ArgValue(string[] args, string name)
    {
        var index = Array.IndexOf(args, name);
        return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
    }
}
