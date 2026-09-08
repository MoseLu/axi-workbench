package email

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"strings"
	"testing"
	"time"
)

func TestComposeMIMEMessageEmbedsOfficialCIDLogo(t *testing.T) {
	asset := BrandLogoInlineAsset()
	html := `<img src="cid:` + asset.ContentID + `" alt="Axi Workbench four-color logo">`
	raw, err := composeMIMEMessage("noreply@example.test", Message{
		To:           "recipient@example.test",
		Subject:      "验证码",
		Text:         "您的验证码：123456",
		HTML:         html,
		InlineAssets: []InlineAsset{asset},
	})
	if err != nil {
		t.Fatalf("compose MIME message: %v", err)
	}
	if bytes.Contains(raw, []byte("您的验证码")) {
		t.Error("UTF-8 message body should use quoted-printable transfer encoding")
	}

	message, err := mail.ReadMessage(bytes.NewReader(raw))
	if err != nil {
		t.Fatalf("parse message: %v", err)
	}
	mediaType, params, err := mime.ParseMediaType(message.Header.Get("Content-Type"))
	if err != nil || mediaType != "multipart/alternative" {
		t.Fatalf("alternative content type = %q (%v)", mediaType, err)
	}
	alternative := multipart.NewReader(message.Body, params["boundary"])
	textPart, err := alternative.NextPart()
	if err != nil {
		t.Fatalf("read text part: %v", err)
	}
	text, err := io.ReadAll(quotedprintable.NewReader(textPart))
	if err != nil || string(text) != "您的验证码：123456" {
		t.Fatalf("decoded text part = %q (%v)", text, err)
	}

	relatedPart, err := alternative.NextPart()
	if err != nil {
		t.Fatalf("read related part: %v", err)
	}
	relatedType, relatedParams, err := mime.ParseMediaType(relatedPart.Header.Get("Content-Type"))
	if err != nil || relatedType != "multipart/related" {
		t.Fatalf("related content type = %q (%v)", relatedType, err)
	}
	related := multipart.NewReader(relatedPart, relatedParams["boundary"])
	htmlPart, err := related.NextPart()
	if err != nil {
		t.Fatalf("read HTML part: %v", err)
	}
	decodedHTML, err := io.ReadAll(quotedprintable.NewReader(htmlPart))
	if err != nil || string(decodedHTML) != html {
		t.Fatalf("decoded HTML = %q (%v)", decodedHTML, err)
	}
	imagePart, err := related.NextPart()
	if err != nil {
		t.Fatalf("read image part: %v", err)
	}
	if got := imagePart.Header.Get("Content-ID"); got != "<"+asset.ContentID+">" {
		t.Errorf("Content-ID = %q", got)
	}
	decodedImage, err := io.ReadAll(base64.NewDecoder(base64.StdEncoding, imagePart))
	if err != nil {
		t.Fatalf("decode inline image: %v", err)
	}
	if !bytes.Equal(decodedImage, asset.Data) {
		t.Errorf("CID image is not the approved four-color asset")
	}
}

func TestComposeMIMEMessageRejectsUnsafeInlineContentID(t *testing.T) {
	_, err := composeMIMEMessage("noreply@example.test", Message{HTML: "<p>test</p>", InlineAssets: []InlineAsset{{ContentID: "logo\r\nBcc: victim@example.test", Data: []byte("x")}}})
	if err == nil {
		t.Fatal("expected unsafe content ID to be rejected")
	}
}

func TestSMTPSenderReturnsFinalDataError(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() { _ = listener.Close() })

	serverDone := make(chan error, 1)
	go func() {
		connection, err := listener.Accept()
		if err != nil {
			serverDone <- err
			return
		}
		defer connection.Close()
		if err := connection.SetDeadline(time.Now().Add(5 * time.Second)); err != nil {
			serverDone <- err
			return
		}

		reader := bufio.NewReader(connection)
		writeResponse := func(response string) error {
			_, err := fmt.Fprint(connection, response)
			return err
		}
		expectCommand := func(prefix string) error {
			line, err := reader.ReadString('\n')
			if err != nil {
				return err
			}
			if !strings.HasPrefix(line, prefix) {
				return fmt.Errorf("command %q does not start with %q", line, prefix)
			}
			return nil
		}

		if err := writeResponse("220 test SMTP\r\n"); err != nil {
			serverDone <- err
			return
		}
		for _, exchange := range []struct {
			command  string
			response string
		}{
			{command: "EHLO ", response: "250 test SMTP\r\n"},
			{command: "MAIL FROM:", response: "250 sender accepted\r\n"},
			{command: "RCPT TO:", response: "250 recipient accepted\r\n"},
			{command: "DATA", response: "354 send message\r\n"},
		} {
			if err := expectCommand(exchange.command); err != nil {
				serverDone <- err
				return
			}
			if err := writeResponse(exchange.response); err != nil {
				serverDone <- err
				return
			}
		}
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				serverDone <- err
				return
			}
			if line == ".\r\n" {
				break
			}
		}
		if err := writeResponse("554 message rejected\r\n"); err != nil {
			serverDone <- err
			return
		}
		if err := expectCommand("QUIT"); err != nil {
			serverDone <- err
			return
		}
		serverDone <- writeResponse("221 bye\r\n")
	}()

	address := listener.Addr().(*net.TCPAddr)
	sender := SMTPSender{
		Host:          "127.0.0.1",
		Port:          fmt.Sprint(address.Port),
		From:          "sender@example.test",
		AllowInsecure: true,
		Timeout:       time.Second,
	}
	err = sender.Send(Message{To: "recipient@example.test", Subject: "test", Text: "body"})
	if err == nil || !strings.Contains(err.Error(), "finalize smtp body") {
		t.Fatalf("Send error = %v, want final DATA rejection", err)
	}
	if err := <-serverDone; err != nil {
		t.Fatalf("SMTP test server: %v", err)
	}
}
