package email

import (
	"bytes"
	"encoding/base64"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net/mail"
	"testing"
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
