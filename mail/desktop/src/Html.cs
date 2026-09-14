using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Ryvoki.Mail.Api;

namespace Ryvoki.Mail;

/// <summary>Builds the HTML shown in the reader, and turns plain-text drafts into simple HTML for sending.</summary>
public static partial class Html
{
    private const string BaseCss = """
        html,body{margin:0;padding:0;background:#0f1418;color:#ebf0f2}
        body{padding:18px 22px;font:14px/1.55 "Segoe UI",system-ui,sans-serif;word-wrap:break-word;overflow-wrap:anywhere}
        a{color:#ff9a7a} img{max-width:100%;height:auto} blockquote{border-left:3px solid #303c44;margin:8px 0;padding:4px 12px;color:#b8c1c7}
        pre{white-space:pre-wrap;font:13.5px/1.55 "Segoe UI",system-ui,sans-serif;margin:0}
        table{max-width:100%} .rv-note{background:#1c242a;border:1px solid #303c44;border-radius:6px;padding:8px 12px;margin:0 0 14px;color:#8d9aa1;font-size:12px}
        """;

    public static string Reader(MessageDoc message, bool loadRemoteImages, IReadOnlyDictionary<string, string> cidDataUris, bool remoteImagesPresent)
    {
        var imgSources = "data: cid:" + (loadRemoteImages ? " https: http:" : "");
        var csp = $"default-src 'none'; img-src {imgSources}; style-src 'unsafe-inline'; font-src data:;";
        string body;
        if (!string.IsNullOrWhiteSpace(message.Html))
        {
            body = message.Html!;
            body = ScriptTag().Replace(body, "");
            foreach (var (cid, dataUri) in cidDataUris)
            {
                body = body.Replace("cid:" + cid, dataUri, StringComparison.OrdinalIgnoreCase);
            }
            var stripped = BodyOnly(body);
            body = stripped;
        }
        else
        {
            body = "<pre>" + Linkify(WebUtility.HtmlEncode(message.Text ?? "")) + "</pre>";
        }

        var note = remoteImagesPresent && !loadRemoteImages ? "<div class=\"rv-note\">Remote images are hidden. Use \"Load images\" to show them.</div>" : "";
        return $"<!doctype html><html><head><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"{csp}\"><style>{BaseCss}</style></head><body>{note}{body}</body></html>";
    }

    public static bool HasRemoteImages(string? html) => !string.IsNullOrEmpty(html) && RemoteImg().IsMatch(html);

    /// <summary>Plain text -> HTML paragraphs with clickable links, for outgoing mail.</summary>
    public static string FromPlainText(string text)
    {
        var sb = new StringBuilder("<div style=\"font:14px/1.5 Segoe UI,Arial,sans-serif;color:#111\">");
        foreach (var paragraph in text.Replace("\r\n", "\n").Split("\n\n"))
        {
            sb.Append("<p style=\"margin:0 0 12px\">").Append(Linkify(WebUtility.HtmlEncode(paragraph)).Replace("\n", "<br>")).Append("</p>");
        }
        return sb.Append("</div>").ToString();
    }

    /// <summary>Best-effort plain text from an HTML body, for quoting replies.</summary>
    public static string ToPlainText(string? html, string? text)
    {
        if (!string.IsNullOrWhiteSpace(text)) return text!;
        if (string.IsNullOrWhiteSpace(html)) return "";
        var s = ScriptTag().Replace(html!, "");
        s = StyleTag().Replace(s, "");
        s = BreakTag().Replace(s, "\n");
        s = AnyTag().Replace(s, "");
        s = WebUtility.HtmlDecode(s);
        return ManyBlankLines().Replace(s, "\n\n").Trim();
    }

    private static string Linkify(string escaped) => Url().Replace(escaped, m => $"<a href=\"{m.Value}\">{m.Value}</a>");

    private static string BodyOnly(string html)
    {
        var m = BodyTag().Match(html);
        return m.Success ? m.Groups[1].Value : html;
    }

    [GeneratedRegex(@"<script[\s\S]*?</script>", RegexOptions.IgnoreCase)] private static partial Regex ScriptTag();
    [GeneratedRegex(@"<style[\s\S]*?</style>", RegexOptions.IgnoreCase)] private static partial Regex StyleTag();
    [GeneratedRegex(@"<(br|/p|/div|/tr|/li|/h[1-6])\s*/?>", RegexOptions.IgnoreCase)] private static partial Regex BreakTag();
    [GeneratedRegex(@"<[^>]+>")] private static partial Regex AnyTag();
    [GeneratedRegex(@"\n{3,}")] private static partial Regex ManyBlankLines();
    [GeneratedRegex(@"<body[^>]*>([\s\S]*?)</body>", RegexOptions.IgnoreCase)] private static partial Regex BodyTag();
    [GeneratedRegex(@"<img[^>]+src\s*=\s*[""']?\s*https?:", RegexOptions.IgnoreCase)] private static partial Regex RemoteImg();
    [GeneratedRegex(@"https?://[^\s<>""']+")] private static partial Regex Url();
}
