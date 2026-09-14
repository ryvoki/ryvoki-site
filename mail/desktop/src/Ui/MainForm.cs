using System.Diagnostics;
using System.Drawing;
using Microsoft.Web.WebView2.WinForms;
using Ryvoki.Mail.Api;

namespace Ryvoki.Mail.Ui;

public sealed class MainForm : Form
{
    private static readonly string[] FolderKeys = ["inbox", "starred", "sent", "archive", "trash"];
    private static readonly string[] FolderNames = ["Inbox", "Starred", "Sent", "Archive", "Trash"];

    private readonly Settings _settings;
    private MailApi _api;
    private readonly ListBox _folders;
    private readonly ListView _list;
    private readonly TextBox _search;
    private readonly Label _status;
    private readonly Label _subject, _fromLine, _toLine, _dateLine, _emptyHint;
    private readonly FlowLayoutPanel _actions, _attachments;
    private readonly Button _reply, _replyAll, _forward, _archive, _delete, _star, _unread, _images, _raw;
    private readonly WebView2 _web;
    private readonly System.Windows.Forms.Timer _poll;
    private readonly NotifyIcon _tray;

    private List<MailRow> _rows = [];
    private MessageDoc? _current;
    private PingInfo? _ping;
    private string _folder = "inbox";
    private string _lastSeenInboxId = "";
    private bool _webReady;
    private bool _loading;
    private CancellationTokenSource? _openCts;
    private readonly string? _snapshotPath;

    public MainForm(Settings settings, string? snapshotPath = null)
    {
        _settings = settings;
        _snapshotPath = snapshotPath;
        _api = new MailApi(settings.ServerUrl, settings.Token);
        Theme.Style(this);
        Icon = Brand.AppIcon;
        Text = "Ryvoki Mail";
        ClientSize = new Size(settings.WindowWidth, settings.WindowHeight);
        MinimumSize = new Size(940, 600);
        StartPosition = FormStartPosition.CenterScreen;
        KeyPreview = true;

        // ---- toolbar ----
        var toolbar = new Panel { Dock = DockStyle.Top, Height = 56, BackColor = Theme.Surface };
        toolbar.Controls.Add(Brand.MarkBox(18, 15));
        var brand = new Label { Text = "RYVOKI  /  MAIL", Location = new Point(52, 18), AutoSize = true, Font = new Font("Segoe UI Semibold", 10.5F, FontStyle.Bold) };
        toolbar.Controls.Add(brand);
        var compose = Theme.Button("Compose", primary: true, width: 104, height: 32);
        compose.Location = new Point(190, 12);
        compose.Click += (_, _) => OpenCompose(ComposeMode.New);
        toolbar.Controls.Add(compose);
        var refresh = Theme.Button("Refresh", width: 84, height: 32);
        refresh.Location = new Point(302, 12);
        refresh.Click += async (_, _) => await RefreshAsync();
        toolbar.Controls.Add(refresh);
        _search = Theme.TextBox();
        _search.Location = new Point(400, 15);
        _search.Size = new Size(280, 26);
        _search.PlaceholderText = "Search subject, sender, text…  (Enter)";
        _search.KeyDown += async (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; await RefreshAsync(); } };
        toolbar.Controls.Add(_search);
        toolbar.Width = ClientSize.Width;
        _status = new Label { AutoSize = false, Size = new Size(380, 22), Location = new Point(toolbar.Width - 450, 18), TextAlign = ContentAlignment.MiddleRight, ForeColor = Theme.Muted, Font = Theme.Small, Anchor = AnchorStyles.Top | AnchorStyles.Right };
        toolbar.Controls.Add(_status);
        var settingsButton = Theme.Button("⚙", width: 34, height: 32);
        settingsButton.Location = new Point(toolbar.Width - 52, 12);
        settingsButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        settingsButton.Click += (_, _) => OpenSettings();
        toolbar.Controls.Add(settingsButton);
        Controls.Add(toolbar);

        // ---- three-pane layout ----
        var outer = new SplitContainer { Dock = DockStyle.Fill, Orientation = Orientation.Vertical, BackColor = Theme.Border, SplitterWidth = 1, FixedPanel = FixedPanel.Panel1 };
        outer.Panel1.BackColor = Theme.Window;
        outer.Panel2.BackColor = Theme.Window;
        var inner = new SplitContainer { Dock = DockStyle.Fill, Orientation = Orientation.Vertical, BackColor = Theme.Border, SplitterWidth = 1 };
        inner.Panel1.BackColor = Theme.Window;
        inner.Panel2.BackColor = Theme.Window;

        _folders = new ListBox { Dock = DockStyle.Fill, BorderStyle = BorderStyle.None, BackColor = Theme.Window, ForeColor = Theme.Text, DrawMode = DrawMode.OwnerDrawFixed, ItemHeight = 36, Font = Theme.Body };
        _folders.Items.AddRange(FolderNames);
        _folders.DrawItem += DrawFolder;
        _folders.SelectedIndexChanged += async (_, _) => { if (_folders.SelectedIndex >= 0) { _folder = FolderKeys[_folders.SelectedIndex]; await RefreshAsync(); } };
        var folderHead = new Label { Dock = DockStyle.Top, Height = 34, Text = "FOLDERS", Padding = new Padding(16, 12, 0, 0), ForeColor = Theme.Muted, Font = Theme.Label };
        outer.Panel1.Controls.Add(_folders);
        outer.Panel1.Controls.Add(folderHead);

        _list = new ListView { Dock = DockStyle.Fill, View = View.Details, FullRowSelect = true, HideSelection = false, MultiSelect = false, HeaderStyle = ColumnHeaderStyle.None, BorderStyle = BorderStyle.None, BackColor = Theme.Window, ForeColor = Theme.Text, OwnerDraw = true, ShowItemToolTips = false };
        _list.Columns.Add("Messages", 400);
        _list.SmallImageList = new ImageList { ImageSize = new Size(1, 56) };
        _list.DrawItem += DrawRow;
        _list.DrawSubItem += (_, e) => e.DrawDefault = false;
        _list.SelectedIndexChanged += async (_, _) => await OpenSelectedAsync();
        _list.Resize += (_, _) => { if (_list.Columns.Count > 0) _list.Columns[0].Width = _list.ClientSize.Width - 4; };
        _list.KeyDown += async (_, e) => { if (e.KeyCode == Keys.Delete) { e.Handled = true; await DeleteCurrentAsync(); } };
        inner.Panel1.Controls.Add(_list);

        // ---- reader ----
        var reader = new Panel { Dock = DockStyle.Fill, BackColor = Theme.Window };
        var head = new Panel { Dock = DockStyle.Top, Height = 160, BackColor = Theme.Surface, Padding = new Padding(18, 12, 18, 10) };
        _subject = new Label { Dock = DockStyle.Top, Height = 30, Font = Theme.Title, AutoEllipsis = true };
        _fromLine = new Label { Dock = DockStyle.Top, Height = 20, Font = Theme.BodyBold, AutoEllipsis = true };
        _toLine = new Label { Dock = DockStyle.Top, Height = 18, ForeColor = Theme.Muted, Font = Theme.Small, AutoEllipsis = true };
        _dateLine = new Label { Dock = DockStyle.Top, Height = 18, ForeColor = Theme.Muted, Font = Theme.Small };
        _actions = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, Padding = new Padding(0, 6, 0, 0), WrapContents = true, AutoScroll = false };
        _reply = Action("Reply", () => OpenCompose(ComposeMode.Reply));
        _replyAll = Action("Reply all", () => OpenCompose(ComposeMode.ReplyAll));
        _forward = Action("Forward", () => _ = ForwardAsync());
        _archive = Action("Archive", () => _ = MoveCurrentAsync("archive"));
        _delete = Action("Delete", () => _ = DeleteCurrentAsync());
        _star = Action("★ Star", () => _ = ToggleStarAsync());
        _unread = Action("Mark unread", () => _ = MarkUnreadAsync());
        _images = Action("Load images", () => _ = RenderCurrentAsync(loadRemote: true));
        _raw = Action("Save .eml", () => _ = SaveRawAsync());
        foreach (var b in new[] { _reply, _replyAll, _forward, _archive, _delete, _star, _unread, _images, _raw }) _actions.Controls.Add(b);
        // The action row wraps on narrow windows; keep the header exactly tall enough for however many rows it needs.
        _actions.SizeChanged += (_, _) => head.Height = head.Padding.Top + 30 + 20 + 18 + 18 + _actions.Height + head.Padding.Bottom;
        head.Controls.Add(_actions);
        head.Controls.Add(_dateLine);
        head.Controls.Add(_toLine);
        head.Controls.Add(_fromLine);
        head.Controls.Add(_subject);
        _attachments = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 0, BackColor = Theme.Window, Padding = new Padding(14, 6, 14, 0), AutoSize = false, Visible = false };
        _web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Theme.Window };
        _emptyHint = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter, ForeColor = Theme.Muted, Font = Theme.Body, Text = "Select a message" };
        reader.Controls.Add(_web);
        reader.Controls.Add(_emptyHint);
        reader.Controls.Add(_attachments);
        reader.Controls.Add(head);
        _emptyHint.BringToFront();
        inner.Panel2.Controls.Add(reader);

        outer.Panel2.Controls.Add(inner);
        Controls.Add(outer);
        Controls.SetChildIndex(outer, 0);
        outer.SplitterDistance = 188;
        inner.SplitterDistance = 420;

        // ---- polling + tray ----
        _poll = new System.Windows.Forms.Timer { Interval = Math.Max(20, settings.PollSeconds) * 1000 };
        _poll.Tick += async (_, _) => await PollAsync();
        _tray = new NotifyIcon { Text = "Ryvoki Mail", Icon = Brand.AppIcon, Visible = true };
        _tray.DoubleClick += (_, _) => { Show(); WindowState = FormWindowState.Normal; Activate(); };
        _tray.BalloonTipClicked += (_, _) => { Show(); WindowState = FormWindowState.Normal; Activate(); };

        Load += async (_, _) => await InitAsync();
        FormClosing += (_, _) => { _tray.Visible = false; _settings.WindowWidth = ClientSize.Width; _settings.WindowHeight = ClientSize.Height; _settings.Save(); };
        KeyDown += async (_, e) =>
        {
            if (e.Control && e.KeyCode == Keys.N) { e.Handled = true; OpenCompose(ComposeMode.New); }
            else if (e.Control && e.KeyCode == Keys.R && _current is not null) { e.Handled = true; OpenCompose(ComposeMode.Reply); }
            else if (e.KeyCode == Keys.F5) { e.Handled = true; await RefreshAsync(); }
            else if (e.Control && e.KeyCode == Keys.F) { e.Handled = true; _search.Focus(); }
        };
        SetReaderEnabled(false);
    }

    private Button Action(string text, System.Action onClick)
    {
        var b = Theme.Button(text, width: TextRenderer.MeasureText(text, Theme.Body).Width + 22, height: 28);
        b.Margin = new Padding(0, 0, 6, 6);
        b.Click += (_, _) => onClick();
        return b;
    }

    // ------------------------------------------------------------------ startup / polling

    private async Task InitAsync()
    {
        try
        {
            await _web.EnsureCoreWebView2Async();
            var s = _web.CoreWebView2.Settings;
            s.IsScriptEnabled = false;
            s.AreDefaultContextMenusEnabled = false;
            s.AreDevToolsEnabled = false;
            s.IsWebMessageEnabled = false;
            s.IsStatusBarEnabled = false;
            s.AreDefaultScriptDialogsEnabled = false;
            s.IsZoomControlEnabled = true;
            _web.CoreWebView2.NavigationStarting += (_, e) =>
            {
                if (e.Uri.StartsWith("about:", StringComparison.OrdinalIgnoreCase) || e.Uri.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) return;
                e.Cancel = true;
                OpenExternal(e.Uri);
            };
            _web.CoreWebView2.NewWindowRequested += (_, e) => { e.Handled = true; OpenExternal(e.Uri); };
            _webReady = true;
        }
        catch (Exception exception)
        {
            SetStatus("Message viewer unavailable (WebView2 runtime missing?): " + exception.Message, Theme.Danger);
        }

        _folders.SelectedIndex = 0; // triggers the first refresh
        _poll.Start();

        if (_snapshotPath is not null)
        {
            await Task.Delay(2500);
            if (_list.Items.Count > 0) { _list.Items[0].Selected = true; await Task.Delay(2500); }
            using var bitmap = new Bitmap(Width, Height);
            DrawToBitmap(bitmap, new Rectangle(Point.Empty, Size));
            bitmap.Save(_snapshotPath, System.Drawing.Imaging.ImageFormat.Png);
            Close();
        }
    }

    private static void OpenExternal(string url)
    {
        if (!url.StartsWith("http", StringComparison.OrdinalIgnoreCase) && !url.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)) return;
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch { /* no browser? nothing to do */ }
    }

    private async Task PollAsync()
    {
        try
        {
            var inbox = await _api.ListAsync("inbox", null, 20);
            var newest = inbox.FirstOrDefault();
            if (newest is not null && !string.IsNullOrEmpty(_lastSeenInboxId) && string.CompareOrdinal(newest.Id, _lastSeenInboxId) > 0)
            {
                var fresh = inbox.Where(r => string.CompareOrdinal(r.Id, _lastSeenInboxId) > 0).ToList();
                var first = fresh[0];
                _tray.ShowBalloonTip(6000, fresh.Count == 1 ? first.Display : $"{fresh.Count} new messages", (first.Subject ?? "(no subject)") + (fresh.Count > 1 ? " …" : ""), ToolTipIcon.None);
                if (_folder == "inbox") await RefreshAsync(silent: true);
            }
            if (newest is not null) _lastSeenInboxId = newest.Id;
            _ping = await _api.PingAsync();
            _folders.Invalidate();
        }
        catch
        {
            // transient; the next tick will try again
        }
    }

    // ------------------------------------------------------------------ list

    private async Task RefreshAsync(bool silent = false)
    {
        if (_loading) return;
        _loading = true;
        if (!silent) SetStatus("Loading…", Theme.Muted);
        try
        {
            var selectedId = _current?.Id;
            _rows = await _api.ListAsync(_folder, _search.Text.Trim(), 150);
            if (_folder == "inbox" && string.IsNullOrWhiteSpace(_search.Text) && _rows.Count > 0 && string.IsNullOrEmpty(_lastSeenInboxId)) _lastSeenInboxId = _rows[0].Id;
            _list.BeginUpdate();
            _list.Items.Clear();
            foreach (var row in _rows) _list.Items.Add(new ListViewItem(row.Subject ?? "") { Tag = row });
            _list.EndUpdate();
            _list.Columns[0].Width = _list.ClientSize.Width - 4;
            if (selectedId is not null)
            {
                var idx = _rows.FindIndex(r => r.Id == selectedId);
                if (idx >= 0) { _list.Items[idx].Selected = true; _list.EnsureVisible(idx); }
                else ClearReader();
            }
            _ping = await _api.PingAsync();
            _folders.Invalidate();
            SetStatus(_rows.Count == 0 ? "Nothing here." : $"{_rows.Count} message{(_rows.Count == 1 ? "" : "s")}" + (_ping?.CanSend == false ? "  ·  sending not set up yet" : ""), Theme.Muted);
        }
        catch (Exception exception)
        {
            SetStatus(exception.Message, Theme.Danger);
        }
        finally
        {
            _loading = false;
        }
    }

    private void DrawFolder(object? sender, DrawItemEventArgs e)
    {
        if (e.Index < 0) return;
        var selected = (e.State & DrawItemState.Selected) != 0;
        using (var bg = new SolidBrush(selected ? Theme.Selection : Theme.Window)) e.Graphics.FillRectangle(bg, e.Bounds);
        if (selected) using (var bar = new SolidBrush(Theme.Accent)) e.Graphics.FillRectangle(bar, new Rectangle(e.Bounds.X, e.Bounds.Y + 6, 3, e.Bounds.Height - 12));
        var key = FolderKeys[e.Index];
        var count = _ping?.Folders.FirstOrDefault(f => f.Folder == key);
        var unread = key == "inbox" ? (count?.Unread ?? 0) : 0;
        var textRect = new Rectangle(e.Bounds.X + 16, e.Bounds.Y, e.Bounds.Width - 60, e.Bounds.Height);
        TextRenderer.DrawText(e.Graphics, FolderNames[e.Index], unread > 0 ? Theme.BodyBold : Theme.Body, textRect, Theme.Text, TextFormatFlags.VerticalCenter | TextFormatFlags.Left);
        if (unread > 0)
        {
            var label = unread.ToString();
            var size = TextRenderer.MeasureText(label, Theme.Label);
            var badge = new Rectangle(e.Bounds.Right - size.Width - 24, e.Bounds.Y + (e.Bounds.Height - 18) / 2, size.Width + 12, 18);
            using var b = new SolidBrush(Theme.Accent);
            e.Graphics.FillRectangle(b, badge);
            TextRenderer.DrawText(e.Graphics, label, Theme.Label, badge, Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    private void DrawRow(object? sender, DrawListViewItemEventArgs e)
    {
        if (e.Item.Tag is not MailRow row) return;
        var selected = e.Item.Selected;
        var bounds = e.Bounds;
        using (var bg = new SolidBrush(selected ? Theme.Selection : Theme.Window)) e.Graphics.FillRectangle(bg, bounds);
        using (var line = new Pen(Theme.Border)) e.Graphics.DrawLine(line, bounds.Left + 14, bounds.Bottom - 1, bounds.Right - 8, bounds.Bottom - 1);
        var unread = row.Unread == 1;
        if (unread) using (var dot = new SolidBrush(Theme.Accent)) e.Graphics.FillEllipse(dot, bounds.Left + 6, bounds.Top + 12, 7, 7);

        var when = row.When;
        var dateText = when == DateTimeOffset.MinValue ? "" : (when.Date == DateTimeOffset.Now.Date ? when.ToString("h:mm tt") : when.ToString("MMM d"));
        var dateWidth = TextRenderer.MeasureText(dateText, Theme.Small).Width + 6;
        var line1 = new Rectangle(bounds.Left + 18, bounds.Top + 6, bounds.Width - 30 - dateWidth, 20);
        var dateRect = new Rectangle(bounds.Right - dateWidth - 10, bounds.Top + 8, dateWidth, 18);
        var line2 = new Rectangle(bounds.Left + 18, bounds.Top + 27, bounds.Width - 30, 20);

        TextRenderer.DrawText(e.Graphics, row.Display, unread ? Theme.BodyBold : Theme.Body, line1, Theme.Text, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
        TextRenderer.DrawText(e.Graphics, dateText, Theme.Small, dateRect, Theme.Muted, TextFormatFlags.Right | TextFormatFlags.NoPrefix);
        var second = (row.Starred == 1 ? "★ " : "") + (row.AttachmentCount > 0 ? "📎 " : "") + (string.IsNullOrWhiteSpace(row.Subject) ? "(no subject)" : row.Subject) + (string.IsNullOrWhiteSpace(row.Snippet) ? "" : "  —  " + row.Snippet);
        TextRenderer.DrawText(e.Graphics, second, unread ? Theme.Body : Theme.Small, line2, unread ? Theme.Text : Theme.Muted, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
    }

    // ------------------------------------------------------------------ reader

    private MailRow? SelectedRow => _list.SelectedItems.Count > 0 ? _list.SelectedItems[0].Tag as MailRow : null;

    private async Task OpenSelectedAsync()
    {
        var row = SelectedRow;
        if (row is null) { ClearReader(); return; }
        _openCts?.Cancel();
        var cts = _openCts = new CancellationTokenSource();
        try
        {
            SetStatus("Opening…", Theme.Muted);
            var doc = await _api.GetAsync(row.Id, cts.Token);
            if (cts.IsCancellationRequested) return;
            _current = doc;
            ShowHeader(doc);
            await RenderCurrentAsync(loadRemote: _settings.LoadRemoteImages);
            if (doc.Unread)
            {
                await _api.PatchAsync(doc.Id, unread: false, ct: cts.Token);
                row.Unread = 0;
                doc.Unread = false;
                _list.Invalidate();
                if (_ping is not null) { var f = _ping.Folders.FirstOrDefault(x => x.Folder == doc.Folder); if (f is not null && f.Unread > 0) f.Unread--; _folders.Invalidate(); }
            }
            SetStatus("", Theme.Muted);
        }
        catch (OperationCanceledException) { }
        catch (Exception exception) { SetStatus(exception.Message, Theme.Danger); }
    }

    private void ShowHeader(MessageDoc doc)
    {
        _subject.Text = string.IsNullOrWhiteSpace(doc.Subject) ? "(no subject)" : doc.Subject;
        _fromLine.Text = (doc.Direction == "out" ? "From: " : "") + doc.From;
        _toLine.Text = "To: " + string.Join(", ", doc.To.Select(a => a.ToString())) + (doc.Cc.Count > 0 ? "   Cc: " + string.Join(", ", doc.Cc.Select(a => a.ToString())) : "");
        _dateLine.Text = (doc.When == DateTimeOffset.MinValue ? doc.Date : doc.When.ToString("dddd, MMMM d, yyyy 'at' h:mm tt")) + "   ·   " + doc.Mailbox;
        _star.Text = doc.Starred ? "★ Starred" : "☆ Star";
        _archive.Text = doc.Folder == "archive" ? "To inbox" : "Archive";
        _delete.Text = doc.Folder == "trash" ? "Delete forever" : "Delete";
        _images.Visible = Html.HasRemoteImages(doc.Html) && !_settings.LoadRemoteImages;

        _attachments.Controls.Clear();
        var files = doc.Attachments.Where(a => !a.Inline || string.IsNullOrEmpty(a.ContentId)).ToList();
        _attachments.Visible = files.Count > 0;
        _attachments.Height = files.Count > 0 ? 40 : 0;
        foreach (var a in files)
        {
            var b = Theme.Button($"📎 {a.Filename}  ({FormatSize(a.Size)})", height: 26);
            b.AutoSize = true;
            b.Margin = new Padding(0, 0, 6, 0);
            b.Click += async (_, _) => await SaveAttachmentAsync(doc, a);
            _attachments.Controls.Add(b);
        }
        _emptyHint.Visible = false;
        SetReaderEnabled(true);
    }

    private async Task RenderCurrentAsync(bool loadRemote)
    {
        var doc = _current;
        if (doc is null || !_webReady) return;
        var cids = new Dictionary<string, string>();
        foreach (var a in doc.Attachments.Where(a => !string.IsNullOrEmpty(a.ContentId) && a.Size < 2_000_000))
        {
            if (doc.Html is null || !doc.Html.Contains("cid:" + a.ContentId, StringComparison.OrdinalIgnoreCase)) continue;
            try { cids[a.ContentId!] = $"data:{a.Mime};base64,{Convert.ToBase64String(await _api.AttachmentAsync(doc.Id, a.Index))}"; } catch { /* image just won't show */ }
        }
        var html = Html.Reader(doc, loadRemote, cids, Html.HasRemoteImages(doc.Html));
        if (loadRemote) _images.Visible = false;
        _web.NavigateToString(html);
    }

    private void ClearReader()
    {
        _current = null;
        _subject.Text = _fromLine.Text = _toLine.Text = _dateLine.Text = "";
        _attachments.Controls.Clear();
        _attachments.Visible = false;
        _attachments.Height = 0;
        if (_webReady) _web.NavigateToString("<html><body style=\"background:#0f1418\"></body></html>");
        _emptyHint.Visible = true;
        SetReaderEnabled(false);
    }

    private void SetReaderEnabled(bool enabled)
    {
        foreach (Control c in _actions.Controls) c.Enabled = enabled;
        if (!enabled) _images.Visible = false;
    }

    // ------------------------------------------------------------------ actions

    private void OpenCompose(ComposeMode mode, IReadOnlyList<(string Name, string Mime, byte[] Bytes)>? forwarded = null)
    {
        if (mode != ComposeMode.New && _current is null) return;
        if (_ping?.CanSend == false)
        {
            MessageBox.Show(this, "Sending isn't switched on yet. Add the RESEND_API_KEY secret to the mail worker first.", "Ryvoki Mail", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }
        using var compose = new ComposeForm(_settings, _api, _ping, mode, mode == ComposeMode.New ? null : _current, forwarded);
        if (compose.ShowDialog(this) == DialogResult.OK)
        {
            SetStatus("Sent.", Theme.Accent);
            if (_folder == "sent") _ = RefreshAsync(silent: true);
        }
    }

    private async Task ForwardAsync()
    {
        var doc = _current;
        if (doc is null) return;
        var files = new List<(string, string, byte[])>();
        try
        {
            foreach (var a in doc.Attachments.Where(a => !a.Inline)) files.Add((a.Filename, a.Mime, await _api.AttachmentAsync(doc.Id, a.Index)));
        }
        catch (Exception exception) { SetStatus("Couldn't fetch attachments: " + exception.Message, Theme.Danger); }
        OpenCompose(ComposeMode.Forward, files);
    }

    private async Task MoveCurrentAsync(string folder)
    {
        var doc = _current;
        if (doc is null) return;
        var target = folder == "archive" && doc.Folder == "archive" ? "inbox" : folder;
        try
        {
            await _api.PatchAsync(doc.Id, folder: target);
            RemoveCurrentFromList();
            SetStatus(target == "inbox" ? "Moved to inbox." : "Archived.", Theme.Muted);
            _ = PollFoldersAsync();
        }
        catch (Exception exception) { SetStatus(exception.Message, Theme.Danger); }
    }

    private async Task DeleteCurrentAsync()
    {
        var doc = _current;
        if (doc is null) return;
        if (doc.Folder == "trash" && MessageBox.Show(this, "Delete this message permanently?", "Ryvoki Mail", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
        try
        {
            var gone = await _api.DeleteAsync(doc.Id);
            RemoveCurrentFromList();
            SetStatus(gone ? "Deleted forever." : "Moved to trash.", Theme.Muted);
            _ = PollFoldersAsync();
        }
        catch (Exception exception) { SetStatus(exception.Message, Theme.Danger); }
    }

    private async Task ToggleStarAsync()
    {
        var doc = _current;
        if (doc is null) return;
        try
        {
            await _api.PatchAsync(doc.Id, starred: !doc.Starred);
            doc.Starred = !doc.Starred;
            var row = _rows.FirstOrDefault(r => r.Id == doc.Id);
            if (row is not null) row.Starred = doc.Starred ? 1 : 0;
            _star.Text = doc.Starred ? "★ Starred" : "☆ Star";
            _list.Invalidate();
        }
        catch (Exception exception) { SetStatus(exception.Message, Theme.Danger); }
    }

    private async Task MarkUnreadAsync()
    {
        var doc = _current;
        if (doc is null) return;
        try
        {
            await _api.PatchAsync(doc.Id, unread: true);
            var row = _rows.FirstOrDefault(r => r.Id == doc.Id);
            if (row is not null) row.Unread = 1;
            _list.SelectedItems.Clear();
            ClearReader();
            _list.Invalidate();
            _ = PollFoldersAsync();
        }
        catch (Exception exception) { SetStatus(exception.Message, Theme.Danger); }
    }

    private async Task SaveAttachmentAsync(MessageDoc doc, AttachmentMeta a)
    {
        using var dialog = new SaveFileDialog { FileName = a.Filename, Title = "Save attachment" };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        try
        {
            File.WriteAllBytes(dialog.FileName, await _api.AttachmentAsync(doc.Id, a.Index));
            SetStatus("Saved " + Path.GetFileName(dialog.FileName), Theme.Muted);
        }
        catch (Exception exception) { SetStatus(exception.Message, Theme.Danger); }
    }

    private async Task SaveRawAsync()
    {
        var doc = _current;
        if (doc is null) return;
        using var dialog = new SaveFileDialog { FileName = (doc.Subject.Length > 0 ? string.Concat(doc.Subject.Where(ch => !Path.GetInvalidFileNameChars().Contains(ch))) : doc.Id) + ".eml", Filter = "Email message (*.eml)|*.eml" };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        try
        {
            File.WriteAllBytes(dialog.FileName, await _api.RawAsync(doc.Id));
            SetStatus("Saved " + Path.GetFileName(dialog.FileName), Theme.Muted);
        }
        catch (Exception exception) { SetStatus(exception.Message, Theme.Danger); }
    }

    private void RemoveCurrentFromList()
    {
        var id = _current?.Id;
        var idx = _rows.FindIndex(r => r.Id == id);
        if (idx >= 0)
        {
            _rows.RemoveAt(idx);
            _list.Items.RemoveAt(idx);
            if (_list.Items.Count > 0)
            {
                _list.Items[Math.Min(idx, _list.Items.Count - 1)].Selected = true; // triggers OpenSelectedAsync
                return;
            }
        }
        ClearReader();
    }

    private async Task PollFoldersAsync()
    {
        try { _ping = await _api.PingAsync(); _folders.Invalidate(); } catch { }
    }

    private void OpenSettings()
    {
        using var setup = new SetupForm(_settings);
        if (setup.ShowDialog(this) == DialogResult.OK)
        {
            _api = new MailApi(_settings.ServerUrl, _settings.Token);
            _ = RefreshAsync();
        }
    }

    private void SetStatus(string text, Color color)
    {
        _status.ForeColor = color;
        _status.Text = text;
    }

    public static string FormatSize(long bytes) => bytes switch
    {
        < 1024 => $"{bytes} B",
        < 1024 * 1024 => $"{bytes / 1024.0:0.#} KB",
        _ => $"{bytes / (1024.0 * 1024.0):0.#} MB",
    };
}
