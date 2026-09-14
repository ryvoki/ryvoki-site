using System.Drawing;
using System.Text;
using Ryvoki.Mail.Api;

namespace Ryvoki.Mail.Ui;

public enum ComposeMode { New, Reply, ReplyAll, Forward }

/// <summary>Compose / reply / forward window. Plain-text editing; sent as text + simple HTML.</summary>
public sealed class ComposeForm : Form
{
    private const long MaxTotalAttachmentBytes = 25L * 1024 * 1024;

    private readonly Settings _settings;
    private readonly MailApi _api;
    private readonly ComboBox _from;
    private readonly TextBox _to, _cc, _bcc, _subject, _body;
    private readonly ListBox _attachmentList;
    private readonly Label _status;
    private readonly Button _send;
    private readonly List<(string Name, string Mime, byte[] Bytes)> _attachments = [];
    private readonly string? _inReplyTo;
    private readonly string? _references;

    public ComposeForm(Settings settings, MailApi api, PingInfo? info, ComposeMode mode, MessageDoc? original, IReadOnlyList<(string Name, string Mime, byte[] Bytes)>? forwardedAttachments = null)
    {
        _settings = settings;
        _api = api;
        Theme.Style(this);
        Icon = Brand.AppIcon;
        Text = mode switch { ComposeMode.Reply => "Reply", ComposeMode.ReplyAll => "Reply all", ComposeMode.Forward => "Forward", _ => "New message" } + " — Ryvoki Mail";
        ClientSize = new Size(780, 640);
        MinimumSize = new Size(620, 480);
        StartPosition = FormStartPosition.CenterParent;

        var grid = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Padding = new Padding(14, 12, 14, 8), BackColor = Theme.Window };
        grid.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 74));
        grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));

        _from = new ComboBox { Dock = DockStyle.Fill, DropDownStyle = ComboBoxStyle.DropDown, FlatStyle = FlatStyle.Flat, BackColor = Theme.Input, ForeColor = Theme.Text, Font = Theme.Body };
        var domain = info?.Domain ?? "ryvoki.com";
        var addresses = new List<string> { settings.DefaultFrom };
        if (info is not null) addresses.AddRange(info.Mailboxes.Select(m => m.Mailbox));
        addresses.Add("support@" + domain);
        foreach (var a in addresses.Where(a => a.EndsWith("@" + domain, StringComparison.OrdinalIgnoreCase)).Distinct(StringComparer.OrdinalIgnoreCase)) _from.Items.Add(a);
        _from.Text = original?.Direction == "in" && original.Mailbox.EndsWith("@" + domain, StringComparison.OrdinalIgnoreCase) ? original.Mailbox : settings.DefaultFrom;

        _to = Theme.TextBox(); _cc = Theme.TextBox(); _bcc = Theme.TextBox(); _subject = Theme.TextBox();
        _body = Theme.TextBox(multiline: true); _body.Font = new Font("Segoe UI", 10.5F); _body.AcceptsTab = false;
        foreach (var t in new[] { _to, _cc, _bcc, _subject, _body }) t.Dock = DockStyle.Fill;

        AddRow(grid, "FROM", _from);
        AddRow(grid, "TO", _to);
        AddRow(grid, "CC", _cc);
        AddRow(grid, "BCC", _bcc);
        AddRow(grid, "SUBJECT", _subject);

        grid.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        grid.Controls.Add(Theme.FieldLabel("BODY"), 0, grid.RowCount);
        grid.Controls.Add(_body, 1, grid.RowCount);
        grid.RowCount++;

        _attachmentList = new ListBox { Dock = DockStyle.Fill, Height = 62, BackColor = Theme.Input, ForeColor = Theme.Text, BorderStyle = BorderStyle.FixedSingle, Font = Theme.Small, Visible = false };
        _attachmentList.DoubleClick += (_, _) => RemoveSelectedAttachment();
        grid.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        grid.Controls.Add(Theme.FieldLabel("FILES"), 0, grid.RowCount);
        grid.Controls.Add(_attachmentList, 1, grid.RowCount);
        grid.RowCount++;
        Controls.Add(grid);

        var bottom = new Panel { Dock = DockStyle.Bottom, Height = 54, BackColor = Theme.Surface };
        bottom.Controls.Add(Theme.Line(DockStyle.Top));
        _send = Theme.Button("Send", primary: true, width: 110, height: 32);
        _send.Location = new Point(14, 11);
        _send.Click += async (_, _) => await SendAsync();
        bottom.Controls.Add(_send);
        var attach = Theme.Button("Attach file…", width: 110, height: 32);
        attach.Location = new Point(132, 11);
        attach.Click += (_, _) => PickAttachment();
        bottom.Controls.Add(attach);
        var remove = Theme.Button("Remove file", width: 100, height: 32);
        remove.Location = new Point(250, 11);
        remove.Click += (_, _) => RemoveSelectedAttachment();
        bottom.Controls.Add(remove);
        _status = new Label { Location = new Point(362, 17), Size = new Size(300, 20), ForeColor = Theme.Muted, Font = Theme.Small, Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top };
        bottom.Controls.Add(_status);
        var cancel = Theme.Button("Discard", width: 90, height: 32);
        cancel.Anchor = AnchorStyles.Right | AnchorStyles.Top;
        cancel.Location = new Point(bottom.Width - 104, 11);
        cancel.DialogResult = DialogResult.Cancel;
        bottom.Controls.Add(cancel);
        CancelButton = cancel;
        Controls.Add(bottom);
        Controls.SetChildIndex(grid, 0);

        // ---- prefill by mode ----
        if (original is not null && mode != ComposeMode.New)
        {
            var quotedText = Html.ToPlainText(original.Html, original.Text);
            var stamp = original.When == DateTimeOffset.MinValue ? original.Date : original.When.ToString("ddd, MMM d, yyyy 'at' h:mm tt");
            if (mode is ComposeMode.Reply or ComposeMode.ReplyAll)
            {
                var replyTarget = original.ReplyTo is { Count: > 0 } ? original.ReplyTo : [original.From];
                _to.Text = string.Join(", ", replyTarget.Select(a => a.ToString()));
                if (mode == ComposeMode.ReplyAll)
                {
                    var mine = new HashSet<string>(addresses, StringComparer.OrdinalIgnoreCase) { original.Mailbox };
                    var others = original.To.Concat(original.Cc).Where(a => !mine.Contains(a.AddressValue) && !replyTarget.Any(r => r.AddressValue.Equals(a.AddressValue, StringComparison.OrdinalIgnoreCase)));
                    _cc.Text = string.Join(", ", others.Select(a => a.ToString()));
                }
                _subject.Text = original.Subject.StartsWith("Re:", StringComparison.OrdinalIgnoreCase) ? original.Subject : "Re: " + original.Subject;
                _inReplyTo = original.Headers.MessageId;
                _references = original.Headers.References;
                _body.Text = settings.Signature.TrimEnd() + "\r\n\r\nOn " + stamp + ", " + original.From + " wrote:\r\n" + Quote(quotedText);
            }
            else
            {
                _subject.Text = original.Subject.StartsWith("Fwd:", StringComparison.OrdinalIgnoreCase) ? original.Subject : "Fwd: " + original.Subject;
                var sb = new StringBuilder();
                sb.Append(settings.Signature.TrimEnd()).Append("\r\n\r\n---------- Forwarded message ----------\r\n");
                sb.Append("From: ").Append(original.From).Append("\r\nDate: ").Append(stamp).Append("\r\nSubject: ").Append(original.Subject).Append("\r\nTo: ").Append(string.Join(", ", original.To.Select(a => a.ToString()))).Append("\r\n\r\n");
                sb.Append(quotedText.Replace("\n", "\r\n"));
                _body.Text = sb.ToString();
                foreach (var f in forwardedAttachments ?? []) AddAttachment(f.Name, f.Mime, f.Bytes);
            }
            _body.SelectionStart = 0;
        }
        else
        {
            _body.Text = settings.Signature;
            _body.SelectionStart = 0;
        }

        Shown += (_, _) => (string.IsNullOrWhiteSpace(_to.Text) ? _to : _body).Focus();
    }

    private static void AddRow(TableLayoutPanel grid, string label, Control field)
    {
        grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 34));
        var l = Theme.FieldLabel(label);
        l.Margin = new Padding(0, 9, 0, 0);
        grid.Controls.Add(l, 0, grid.RowCount);
        field.Margin = new Padding(0, 3, 0, 3);
        grid.Controls.Add(field, 1, grid.RowCount);
        grid.RowCount++;
    }

    private static string Quote(string text)
    {
        var sb = new StringBuilder();
        foreach (var line in text.Replace("\r\n", "\n").Split('\n')) sb.Append("> ").Append(line).Append("\r\n");
        return sb.ToString();
    }

    private void PickAttachment()
    {
        using var dialog = new OpenFileDialog { Multiselect = true, Title = "Attach files" };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        foreach (var path in dialog.FileNames)
        {
            try
            {
                AddAttachment(Path.GetFileName(path), MimeFor(path), File.ReadAllBytes(path));
            }
            catch (Exception exception)
            {
                SetStatus("Couldn't read " + Path.GetFileName(path) + ": " + exception.Message, Theme.Danger);
            }
        }
    }

    private void AddAttachment(string name, string mime, byte[] bytes)
    {
        if (_attachments.Sum(a => (long)a.Bytes.Length) + bytes.Length > MaxTotalAttachmentBytes)
        {
            SetStatus("Attachments are limited to 25 MB per message.", Theme.Danger);
            return;
        }
        _attachments.Add((name, mime, bytes));
        _attachmentList.Items.Add($"{name}  ({MainForm.FormatSize(bytes.Length)})");
        _attachmentList.Visible = true;
    }

    private void RemoveSelectedAttachment()
    {
        var index = _attachmentList.SelectedIndex;
        if (index < 0) return;
        _attachments.RemoveAt(index);
        _attachmentList.Items.RemoveAt(index);
        _attachmentList.Visible = _attachments.Count > 0;
    }

    private static string MimeFor(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", ".gif" => "image/gif", ".webp" => "image/webp",
        ".pdf" => "application/pdf", ".zip" => "application/zip", ".txt" => "text/plain", ".json" => "application/json",
        ".mp4" => "video/mp4", ".mp3" => "audio/mpeg", ".csv" => "text/csv", _ => "application/octet-stream",
    };

    private async Task SendAsync()
    {
        var from = _from.Text.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(_to.Text) && string.IsNullOrWhiteSpace(_cc.Text) && string.IsNullOrWhiteSpace(_bcc.Text))
        {
            SetStatus("Add at least one recipient.", Theme.Danger);
            _to.Focus();
            return;
        }
        if (string.IsNullOrWhiteSpace(_subject.Text) &&
            MessageBox.Show(this, "Send without a subject?", "Ryvoki Mail", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes)
        {
            return;
        }

        _send.Enabled = false;
        SetStatus("Sending…", Theme.Muted);
        try
        {
            var text = _body.Text.Replace("\r\n", "\n");
            await _api.SendAsync(new SendRequest
            {
                From = from,
                FromName = _settings.FromName,
                To = _to.Text,
                Cc = _cc.Text,
                Bcc = _bcc.Text,
                Subject = _subject.Text.Trim(),
                Text = text,
                Html = Html.FromPlainText(text),
                InReplyTo = _inReplyTo,
                References = _references,
                Attachments = _attachments.Select(a => new OutgoingAttachment { Filename = a.Name, Mime = a.Mime, ContentBase64 = Convert.ToBase64String(a.Bytes) }).ToList(),
            });
            DialogResult = DialogResult.OK;
            Close();
        }
        catch (Exception exception)
        {
            SetStatus(exception.Message, Theme.Danger);
            _send.Enabled = true;
        }
    }

    private void SetStatus(string text, Color color)
    {
        _status.ForeColor = color;
        _status.Text = text;
    }
}
