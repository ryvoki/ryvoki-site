using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ryvoki.Mail.Api;

public sealed class MailApiException(string message, int status = 0, string? code = null) : Exception(message)
{
    public int Status { get; } = status;
    public string? Code { get; } = code;
}

// ---- rows from the list endpoint (snake_case in JSON) ----
public sealed class MailRow
{
    public string Id { get; set; } = "";
    public string Folder { get; set; } = "inbox";
    public string Direction { get; set; } = "in";
    public string? Mailbox { get; set; }
    public string? FromAddr { get; set; }
    public string? FromName { get; set; }
    public string? ToAddrs { get; set; }
    public string? Subject { get; set; }
    public string? Snippet { get; set; }
    public string Date { get; set; } = "";
    public int Unread { get; set; }
    public int Starred { get; set; }
    public int AttachmentCount { get; set; }
    public long? Size { get; set; }

    public string Display => Direction == "out"
        ? "To: " + (string.IsNullOrWhiteSpace(ToAddrs) ? "?" : ToAddrs)
        : (string.IsNullOrWhiteSpace(FromName) ? (FromAddr ?? "?") : FromName!);
    public DateTimeOffset When => DateTimeOffset.TryParse(Date, out var d) ? d.ToLocalTime() : DateTimeOffset.MinValue;
}

// ---- full message document (camelCase in JSON) ----
public sealed class Address
{
    public string? Name { get; set; }
    public string AddressValue { get; set; } = "";
    [JsonPropertyName("address")] public string Addr { get => AddressValue; set => AddressValue = value; }
    public override string ToString() => string.IsNullOrWhiteSpace(Name) ? AddressValue : $"{Name} <{AddressValue}>";
}

public sealed class AttachmentMeta
{
    public int Index { get; set; }
    public string Filename { get; set; } = "";
    public string Mime { get; set; } = "application/octet-stream";
    public long Size { get; set; }
    public string? ContentId { get; set; }
    public bool Inline { get; set; }
}

public sealed class MessageHeaders
{
    public string? MessageId { get; set; }
    public string? InReplyTo { get; set; }
    public string? References { get; set; }
}

public sealed class MessageDoc
{
    public string Id { get; set; } = "";
    public string Direction { get; set; } = "in";
    public string Mailbox { get; set; } = "";
    public Address From { get; set; } = new();
    public List<Address> To { get; set; } = [];
    public List<Address> Cc { get; set; } = [];
    public List<Address>? Bcc { get; set; }
    public List<Address>? ReplyTo { get; set; }
    public string Subject { get; set; } = "";
    public string Date { get; set; } = "";
    public string? Html { get; set; }
    public string? Text { get; set; }
    public List<AttachmentMeta> Attachments { get; set; } = [];
    public MessageHeaders Headers { get; set; } = new();
    public string Folder { get; set; } = "inbox";
    public bool Unread { get; set; }
    public bool Starred { get; set; }
    public DateTimeOffset When => DateTimeOffset.TryParse(Date, out var d) ? d.ToLocalTime() : DateTimeOffset.MinValue;
}

public sealed class FolderCount { public string Folder { get; set; } = ""; public int N { get; set; } public int Unread { get; set; } }
public sealed class MailboxCount { public string Mailbox { get; set; } = ""; public int N { get; set; } }

public sealed class PingInfo
{
    public bool Ok { get; set; }
    public string Domain { get; set; } = "";
    public string DefaultFrom { get; set; } = "";
    public string DefaultFromName { get; set; } = "";
    public bool CanSend { get; set; }
    public List<FolderCount> Folders { get; set; } = [];
    public List<MailboxCount> Mailboxes { get; set; } = [];
}

public sealed class OutgoingAttachment
{
    public string Filename { get; set; } = "";
    public string Mime { get; set; } = "application/octet-stream";
    public string ContentBase64 { get; set; } = "";
}

public sealed class SendRequest
{
    public string From { get; set; } = "";
    public string FromName { get; set; } = "";
    public string To { get; set; } = "";
    public string Cc { get; set; } = "";
    public string Bcc { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Text { get; set; } = "";
    public string Html { get; set; } = "";
    public string? InReplyTo { get; set; }
    public string? References { get; set; }
    public List<OutgoingAttachment> Attachments { get; set; } = [];
}

/// <summary>Thin client for the ryvoki-mail worker API.</summary>
public sealed class MailApi
{
    private static readonly JsonSerializerOptions Snake = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower, PropertyNameCaseInsensitive = true };
    private static readonly JsonSerializerOptions Camel = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    private readonly HttpClient _http;
    private readonly string _base;

    public MailApi(string serverUrl, string token)
    {
        _base = serverUrl.TrimEnd('/');
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("RyvokiMail/1.0");
    }

    public Task<PingInfo> PingAsync(CancellationToken ct = default) => GetJsonAsync<PingInfo>("/v1/ping", Camel, ct);

    public async Task<List<MailRow>> ListAsync(string folder, string? query = null, int limit = 100, CancellationToken ct = default)
    {
        var url = $"/v1/messages?folder={Uri.EscapeDataString(folder)}&limit={limit}" + (string.IsNullOrWhiteSpace(query) ? "" : "&q=" + Uri.EscapeDataString(query));
        using var doc = await GetDocumentAsync(url, ct);
        var rows = doc.RootElement.GetProperty("messages").Deserialize<List<MailRow>>(Snake) ?? [];
        return rows;
    }

    public async Task<MessageDoc> GetAsync(string id, CancellationToken ct = default)
    {
        using var doc = await GetDocumentAsync($"/v1/messages/{id}", ct);
        return doc.RootElement.GetProperty("message").Deserialize<MessageDoc>(Camel) ?? throw new MailApiException("Empty message");
    }

    public async Task PatchAsync(string id, bool? unread = null, bool? starred = null, string? folder = null, CancellationToken ct = default)
    {
        var body = new Dictionary<string, object?>();
        if (unread is not null) body["unread"] = unread;
        if (starred is not null) body["starred"] = starred;
        if (folder is not null) body["folder"] = folder;
        using var request = new HttpRequestMessage(HttpMethod.Patch, _base + $"/v1/messages/{id}") { Content = JsonContent(body) };
        using var response = await _http.SendAsync(request, ct);
        await EnsureOkAsync(response, ct);
    }

    /// <summary>Returns true when the message was permanently deleted (it was already in trash), false when it was moved to trash.</summary>
    public async Task<bool> DeleteAsync(string id, CancellationToken ct = default)
    {
        using var response = await _http.DeleteAsync(_base + $"/v1/messages/{id}", ct);
        var text = await EnsureOkAsync(response, ct);
        return text.Contains("\"deleted\":true", StringComparison.Ordinal);
    }

    public async Task<byte[]> AttachmentAsync(string id, int index, CancellationToken ct = default)
    {
        using var response = await _http.GetAsync(_base + $"/v1/messages/{id}/attachments/{index}", ct);
        if (!response.IsSuccessStatusCode) await EnsureOkAsync(response, ct);
        return await response.Content.ReadAsByteArrayAsync(ct);
    }

    public async Task<byte[]> RawAsync(string id, CancellationToken ct = default)
    {
        using var response = await _http.GetAsync(_base + $"/v1/messages/{id}/raw", ct);
        if (!response.IsSuccessStatusCode) await EnsureOkAsync(response, ct);
        return await response.Content.ReadAsByteArrayAsync(ct);
    }

    public async Task SendAsync(SendRequest send, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, _base + "/v1/send") { Content = JsonContent(send) };
        using var response = await _http.SendAsync(request, ct);
        await EnsureOkAsync(response, ct);
    }

    // ---- plumbing ----
    private static StringContent JsonContent(object body) => new(JsonSerializer.Serialize(body, Camel), Encoding.UTF8, "application/json");

    private async Task<T> GetJsonAsync<T>(string path, JsonSerializerOptions options, CancellationToken ct)
    {
        using var response = await _http.GetAsync(_base + path, ct);
        var text = await EnsureOkAsync(response, ct);
        return JsonSerializer.Deserialize<T>(text, options) ?? throw new MailApiException("Empty response");
    }

    private async Task<JsonDocument> GetDocumentAsync(string path, CancellationToken ct)
    {
        using var response = await _http.GetAsync(_base + path, ct);
        var text = await EnsureOkAsync(response, ct);
        return JsonDocument.Parse(text);
    }

    private static async Task<string> EnsureOkAsync(HttpResponseMessage response, CancellationToken ct)
    {
        var text = await response.Content.ReadAsStringAsync(ct);
        if (response.IsSuccessStatusCode) return text;
        string? code = null, message = null;
        try
        {
            using var doc = JsonDocument.Parse(text);
            if (doc.RootElement.TryGetProperty("error", out var e)) code = e.GetString();
            if (doc.RootElement.TryGetProperty("message", out var m)) message = m.GetString();
        }
        catch { /* not JSON */ }
        throw new MailApiException(message ?? $"Server error {(int)response.StatusCode}", (int)response.StatusCode, code);
    }
}
