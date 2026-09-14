using System.Drawing;
using Ryvoki.Mail.Api;

namespace Ryvoki.Mail.Ui;

/// <summary>First-run screen: server address and access token, tested before saving.</summary>
public sealed class SetupForm : Form
{
    private readonly Settings _settings;
    private readonly TextBox _server;
    private readonly TextBox _token;
    private readonly TextBox _fromName;
    private readonly Label _status;
    private readonly Button _connect;

    public SetupForm(Settings settings)
    {
        _settings = settings;
        Theme.Style(this);
        Icon = Brand.AppIcon;
        Text = "Ryvoki Mail — connect";
        ClientSize = new Size(440, 350);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;

        var header = new Panel { Dock = DockStyle.Top, Height = 58, BackColor = Theme.Surface };
        header.Controls.Add(Brand.MarkBox(18, 16));
        header.Controls.Add(new Label { Text = "RYVOKI  /  MAIL", Location = new Point(52, 11), AutoSize = true, Font = new Font("Segoe UI Semibold", 10.5F, FontStyle.Bold) });
        header.Controls.Add(new Label { Text = "Connect to your mail server", Location = new Point(52, 32), AutoSize = true, ForeColor = Theme.Muted, Font = Theme.Small });
        Controls.Add(header);
        Controls.Add(Theme.Line(DockStyle.Top));

        var y = 74;
        Controls.Add(Place(Theme.FieldLabel("SERVER"), 18, y));
        _server = Theme.TextBox(); _server.Text = settings.ServerUrl; Controls.Add(Place(_server, 18, y + 18, 404));
        y += 56;
        Controls.Add(Place(Theme.FieldLabel("ACCESS TOKEN (from mail-token.txt)"), 18, y));
        _token = Theme.TextBox(); _token.UseSystemPasswordChar = true; _token.Font = Theme.Mono; Controls.Add(Place(_token, 18, y + 18, 404));
        y += 56;
        Controls.Add(Place(Theme.FieldLabel("YOUR NAME ON OUTGOING MAIL"), 18, y));
        _fromName = Theme.TextBox(); _fromName.Text = settings.FromName; Controls.Add(Place(_fromName, 18, y + 18, 404));
        y += 60;

        _connect = Theme.Button("Connect", primary: true, width: 404, height: 34);
        _connect.Location = new Point(18, y);
        _connect.Click += async (_, _) => await ConnectAsync();
        Controls.Add(_connect);
        AcceptButton = _connect;

        var why = settings.IsConfigured
            ? "The token is stored encrypted for your Windows account only."
            : $"Why you see this: {(Settings.LoadError == "" ? "settings file has no token" : Settings.LoadError)}\nLooked in: {Settings.Location}\nRunning as: {Environment.UserName}";
        _status = new Label { Location = new Point(18, y + 44), Size = new Size(404, 60), ForeColor = Theme.Muted, Font = Theme.Small, Text = why };
        Controls.Add(_status);
    }

    private static Control Place(Control control, int x, int y, int width = 0)
    {
        control.Location = new Point(x, y);
        if (width > 0) control.Width = width;
        return control;
    }

    private async Task ConnectAsync()
    {
        var server = _server.Text.Trim().TrimEnd('/');
        var token = _token.Text.Trim();
        if (!server.StartsWith("http", StringComparison.OrdinalIgnoreCase) || token.Length < 16)
        {
            _status.ForeColor = Theme.Danger;
            _status.Text = "Enter the server address and paste the whole token.";
            return;
        }

        _connect.Enabled = false;
        _status.ForeColor = Theme.Muted;
        _status.Text = "Connecting…";
        try
        {
            var info = await new MailApi(server, token).PingAsync();
            _settings.ServerUrl = server;
            _settings.Token = token;
            _settings.FromName = string.IsNullOrWhiteSpace(_fromName.Text) ? "Ryvoki" : _fromName.Text.Trim();
            _settings.DefaultFrom = string.IsNullOrWhiteSpace(info.DefaultFrom) ? _settings.DefaultFrom : info.DefaultFrom;
            _settings.Save();
            DialogResult = DialogResult.OK;
            Close();
        }
        catch (MailApiException exception)
        {
            _status.ForeColor = Theme.Danger;
            _status.Text = exception.Status == 401 ? "The server rejected that token." : exception.Message;
        }
        catch (Exception exception)
        {
            _status.ForeColor = Theme.Danger;
            _status.Text = "Couldn't reach the server: " + exception.Message;
        }
        finally
        {
            _connect.Enabled = true;
        }
    }
}
