using System.Drawing;

namespace Ryvoki.Mail;

/// <summary>Window icon and logo mark, embedded in the executable.</summary>
public static class Brand
{
    private static Icon? _icon;
    private static Image? _mark;

    public static Icon AppIcon
    {
        get
        {
            if (_icon is not null) return _icon;
            try { _icon = Icon.ExtractAssociatedIcon(Environment.ProcessPath ?? Application.ExecutablePath); } catch { /* fall through */ }
            return _icon ??= SystemIcons.Application;
        }
    }

    public static Image? Mark
    {
        get
        {
            if (_mark is not null) return _mark;
            try
            {
                using var stream = typeof(Brand).Assembly.GetManifestResourceStream("Ryvoki.mark.png");
                if (stream is not null) _mark = Image.FromStream(stream);
            }
            catch { /* header simply shows no mark */ }
            return _mark;
        }
    }

    public static PictureBox MarkBox(int x, int y, int size = 26) => new()
    {
        Image = Mark,
        Location = new Point(x, y),
        Size = new Size(size, size),
        SizeMode = PictureBoxSizeMode.Zoom,
        BackColor = Color.Transparent,
    };
}
