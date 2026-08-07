package email

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"log/slog"
	"net"
	"net/smtp"
	"strings"
	"time"
)

type Message struct {
	To      string
	Subject string
	Text    string
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
	// Never log the verification token contained in the body.
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
	defer body.Close()

	var content bytes.Buffer
	content.WriteString("From: " + s.From + "\r\n")
	content.WriteString("To: " + message.To + "\r\n")
	content.WriteString("Subject: " + sanitizeHeader(message.Subject) + "\r\n")
	content.WriteString("MIME-Version: 1.0\r\n")
	content.WriteString("Content-Type: text/plain; charset=UTF-8\r\n\r\n")
	content.WriteString(message.Text)
	if _, err := body.Write(content.Bytes()); err != nil {
		return fmt.Errorf("write smtp body: %w", err)
	}
	return nil
}

func sanitizeHeader(value string) string {
	return strings.NewReplacer("\r", " ", "\n", " ").Replace(value)
}
