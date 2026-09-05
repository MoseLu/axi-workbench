package email

import (
	"bytes"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"log/slog"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/smtp"
	"strings"
	"time"
)

type InlineAsset struct {
	ContentID   string
	ContentType string
	Filename    string
	Data        []byte
}
type Message struct {
	To           string
	Subject      string
	Text         string
	HTML         string
	InlineAssets []InlineAsset
}

// Sender is deliberately small so production SMTP can be swapped for a
// provider adapter without coupling identity flows to a delivery provider.
type Sender interface {
	Send(Message) error
}

type LogSender struct {
	Logger *slog.Logger
}

func (s LogSender) Send(message Message) error {
	logger := s.Logger
	if logger == nil {
		logger = slog.Default()
	}
	// Verification messages are credentials. Even a local opt-in must not put
	// their body into shared logs; use a real SMTP test transport when a human
	// needs to receive the code.
	logger.Info("identity email queued in development log transport", "recipient", message.To, "subject", message.Subject)
	return nil
}

type SMTPSender struct {
	Host          string
	Port          string
	Username      string
	Password      string
	From          string
	AllowInsecure bool
	Timeout       time.Duration
}

func (s SMTPSender) Send(message Message) error {
	if message.To == "" {
		return fmt.Errorf("email recipient is required")
	}
	address := net.JoinHostPort(s.Host, s.Port)
	dialer := net.Dialer{Timeout: s.Timeout}
	connection, err := dialer.Dial("tcp", address)
	if err != nil {
		return fmt.Errorf("dial smtp server: %w", err)
	}
	defer connection.Close()

	client, err := smtp.NewClient(connection, s.Host)
	if err != nil {
		return fmt.Errorf("create smtp client: %w", err)
	}
	defer client.Quit()

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: s.Host, MinVersion: tls.VersionTLS12}); err != nil {
			return fmt.Errorf("start smtp TLS: %w", err)
		}
	} else if !s.AllowInsecure {
		return fmt.Errorf("smtp server does not offer STARTTLS")
	}

	if s.Username != "" {
		if ok, _ := client.Extension("AUTH"); !ok {
			return fmt.Errorf("smtp server does not offer authentication")
		}
		if err := client.Auth(smtp.PlainAuth("", s.Username, s.Password, s.Host)); err != nil {
			return fmt.Errorf("authenticate smtp client: %w", err)
		}
	}
	if err := client.Mail(s.From); err != nil {
		return fmt.Errorf("set smtp sender: %w", err)
	}
	if err := client.Rcpt(message.To); err != nil {
		return fmt.Errorf("set smtp recipient: %w", err)
	}
	body, err := client.Data()
	if err != nil {
		return fmt.Errorf("open smtp body: %w", err)
	}

	content, err := composeMIMEMessage(s.From, message)
	if err != nil {
		return fmt.Errorf("compose smtp body: %w", err)
	}
	if _, err := body.Write(content); err != nil {
		return fmt.Errorf("write smtp body: %w", err)
	}
	if err := body.Close(); err != nil {
		return fmt.Errorf("finalize smtp body: %w", err)
	}
	return nil
}

// composeMIMEMessage keeps multipart construction testable without opening an
// SMTP connection. HTML plus inline assets is represented as
// multipart/alternative -> multipart/related, the shape expected by webmail
// clients for cid: images.
func composeMIMEMessage(from string, message Message) ([]byte, error) {
	var content bytes.Buffer
	content.WriteString("From: " + sanitizeHeader(from) + "\r\n")
	content.WriteString("To: " + sanitizeHeader(message.To) + "\r\n")
	content.WriteString("Subject: " + encodeHeader(message.Subject) + "\r\n")
	content.WriteString("MIME-Version: 1.0\r\n")

	if message.HTML == "" {
		if err := writeQuotedPrintablePart(&content, "text/plain; charset=UTF-8", message.Text); err != nil {
			return nil, err
		}
		return content.Bytes(), nil
	}

	stamp := time.Now().UnixNano()
	alternativeBoundary := fmt.Sprintf("axi-alt-%x", stamp)
	content.WriteString("Content-Type: multipart/alternative; boundary=\"" + alternativeBoundary + "\"\r\n\r\n")

	content.WriteString("--" + alternativeBoundary + "\r\n")
	if err := writeQuotedPrintablePart(&content, "text/plain; charset=UTF-8", message.Text); err != nil {
		return nil, err
	}

	content.WriteString("--" + alternativeBoundary + "\r\n")
	if len(message.InlineAssets) == 0 {
		if err := writeQuotedPrintablePart(&content, "text/html; charset=UTF-8", message.HTML); err != nil {
			return nil, err
		}
	} else {
		relatedBoundary := fmt.Sprintf("axi-related-%x", stamp)
		content.WriteString("Content-Type: multipart/related; type=\"text/html\"; boundary=\"" + relatedBoundary + "\"\r\n\r\n")

		content.WriteString("--" + relatedBoundary + "\r\n")
		if err := writeQuotedPrintablePart(&content, "text/html; charset=UTF-8", message.HTML); err != nil {
			return nil, err
		}
		for _, asset := range message.InlineAssets {
			content.WriteString("--" + relatedBoundary + "\r\n")
			if err := writeInlineAssetPart(&content, asset); err != nil {
				return nil, err
			}
		}
		content.WriteString("--" + relatedBoundary + "--\r\n")
	}
	content.WriteString("--" + alternativeBoundary + "--\r\n")
	return content.Bytes(), nil
}

func writeQuotedPrintablePart(content *bytes.Buffer, contentType, value string) error {
	content.WriteString("Content-Type: " + contentType + "\r\n")
	content.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")
	writer := quotedprintable.NewWriter(content)
	if _, err := writer.Write([]byte(value)); err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	content.WriteString("\r\n")
	return nil
}

func writeInlineAssetPart(content *bytes.Buffer, asset InlineAsset) error {
	contentID, err := normalizedContentID(asset.ContentID)
	if err != nil {
		return err
	}
	if len(asset.Data) == 0 {
		return fmt.Errorf("inline asset %q has no data", contentID)
	}

	contentType := strings.TrimSpace(asset.ContentType)
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	filename := strings.TrimSpace(sanitizeHeader(asset.Filename))
	if filename == "" {
		filename = "inline"
	}
	if formatted := mime.FormatMediaType(contentType, map[string]string{"name": filename}); formatted != "" {
		contentType = formatted
	} else {
		contentType = "application/octet-stream"
	}

	disposition := mime.FormatMediaType("inline", map[string]string{"filename": filename})
	content.WriteString("Content-Type: " + contentType + "\r\n")
	content.WriteString("Content-Transfer-Encoding: base64\r\n")
	content.WriteString("Content-ID: <" + contentID + ">\r\n")
	content.WriteString("Content-Disposition: " + disposition + "\r\n\r\n")
	writeBase64(content, asset.Data)
	content.WriteString("\r\n")
	return nil
}

func normalizedContentID(value string) (string, error) {
	id := strings.Trim(strings.TrimSpace(value), "<>")
	if id == "" || strings.ContainsAny(id, "\r\n<>\"\\") {
		return "", fmt.Errorf("invalid inline asset content ID")
	}
	for _, runeValue := range id {
		if runeValue <= ' ' || runeValue == 0x7f {
			return "", fmt.Errorf("invalid inline asset content ID")
		}
	}
	return id, nil
}

func writeBase64(content *bytes.Buffer, value []byte) {
	encoded := base64.StdEncoding.EncodeToString(value)
	for len(encoded) > 76 {
		content.WriteString(encoded[:76])
		content.WriteString("\r\n")
		encoded = encoded[76:]
	}
	content.WriteString(encoded)
	content.WriteString("\r\n")
}
func encodeHeader(value string) string {
	value = sanitizeHeader(value)
	for _, runeValue := range value {
		if runeValue > 0x7f {
			return mime.QEncoding.Encode("UTF-8", value)
		}
	}
	return value
}

func sanitizeHeader(value string) string {
	return strings.NewReplacer("\r", " ", "\n", " ").Replace(value)
}
