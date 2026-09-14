using System.Drawing;

namespace Ryvoki.Mail.Ui;

/// <summary>Shared dark palette and control factories, same family as the Rank Tracker.</summary>
public static class Theme
{
    public static readonly Color Window = Color.FromArgb(15, 20, 24);
    public static readonly Color Surface = Color.FromArgb(23, 30, 35);
    public static readonly Color Input = Color.FromArgb(28, 36, 42);
    public static readonly Color Border = Color.FromArgb(48, 60, 68);
    public static readonly Color Text = Color.FromArgb(235, 240, 242);
    public static readonly Color Muted = Color.FromArgb(141, 154, 161);
    public static readonly Color Accent = Color.FromArgb(255, 92, 58);
    public static readonly Color AccentHover = Color.FromArgb(255, 120, 90);
    public static readonly Color Danger = Color.FromArgb(232, 120, 110);
    public static readonly Color Selection = Color.FromArgb(52, 38, 34);
    public static readonly Color Hover = Color.FromArgb(35, 45, 51);

    public static readonly Font Body = new("Segoe UI", 9.5F);
    public static readonly Font BodyBold = new("Segoe UI Semibold", 9.5F, FontStyle.Bold);
    public static readonly Font Small = new("Segoe UI", 8.25F);
    public static readonly Font Label = new("Segoe UI Semibold", 7.75F, FontStyle.Bold);
    public static readonly Font Title = new("Segoe UI Semibold", 14F, FontStyle.Bold);
    public static readonly Font Mono = new("Consolas", 10F);

    public static Button Button(string text, bool primary = false, int width = 96, int height = 30)
    {
        var button = new Button
        {
            Text = text,
            Size = new Size(width, height),
            FlatStyle = FlatStyle.Flat,
            Cursor = Cursors.Hand,
            BackColor = primary ? Accent : Input,
            ForeColor = primary ? Color.White : Text,
            Font = primary ? BodyBold : Body,
            TabStop = true,
        };
        button.FlatAppearance.BorderColor = primary ? Accent : Border;
        button.FlatAppearance.MouseOverBackColor = primary ? AccentHover : Hover;
        button.FlatAppearance.MouseDownBackColor = primary ? Accent : Color.FromArgb(42, 54, 61);
        return button;
    }

    public static Label FieldLabel(string text) => new() { Text = text, AutoSize = true, ForeColor = Muted, Font = Label };

    public static TextBox TextBox(bool multiline = false) => new()
    {
        BackColor = Input,
        ForeColor = Text,
        BorderStyle = BorderStyle.FixedSingle,
        Font = Body,
        Multiline = multiline,
        ScrollBars = multiline ? ScrollBars.Vertical : ScrollBars.None,
        AcceptsReturn = multiline,
    };

    public static Panel Line(DockStyle dock) => new() { Dock = dock, Height = 1, Width = 1, BackColor = Border };

    public static void Style(Form form)
    {
        form.BackColor = Window;
        form.ForeColor = Text;
        form.Font = Body;
        form.AutoScaleMode = AutoScaleMode.Dpi;
    }
}
