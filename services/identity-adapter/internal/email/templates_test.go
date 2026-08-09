package email

import (
	"strings"
	"testing"
	"time"
)

func TestRenderVerificationCodeHTML(t *testing.T) {
	params := VerificationCodeParams{
		Brand:     "Axi Workbench",
		Purpose:   "login",
		Code:      "123456",
		ExpiresAt: time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC),
		HelpURL:   "https://example.test/help",
	}
	html := RenderVerificationCodeHTML(params)

	required := []string{
		"<!DOCTYPE html>",
		"Axi Workbench",
		"123456",
		"您的验证码",
		"帮助中心",
		"https://example.test/help",
		// 时间格式：本地时间，不带 UTC / 时区前缀
		"2026-08-08 20:00",
		// OpenAI-style sage-green theme accents.
		"#10A37F",
		"#ECFDF5",
		// Delivered email references the approved logo through its CID attachment.
		`<img class="logo-img"`,
		`src="cid:axi-workbench-logo@axi.local"`,
		`width="56"`,
		`height="56"`,
		`object-fit:contain`,
		`alt="Axi Workbench four-color logo"`,
		// The verification card itself is deliberately only the selectable code.
		`<div class="code-card">`,
		`<p class="code">123456</p>`,
		`color: #2F9E68`,
		`user-select: all`,
	}
	for _, needle := range required {
		if !strings.Contains(html, needle) {
			t.Errorf("HTML missing %q", needle)
		}
	}
	if strings.Contains(html, "data:image/png") {
		t.Error("delivered HTML must not depend on a data: image URL")
	}
	codeCardStart := strings.Index(html, `<div class="code-card">`)
	if codeCardStart < 0 {
		t.Fatal("verification code card missing")
	}
	codeCardEnd := strings.Index(html[codeCardStart:], `</div>`)
	if codeCardEnd < 0 {
		t.Fatal("verification code card is not closed")
	}
	codeCard := html[codeCardStart : codeCardStart+codeCardEnd]
	for _, banned := range []string{"code-label", "expires", "过期时间："} {
		if strings.Contains(codeCard, banned) {
			t.Errorf("verification code card should contain only the code, found %q", banned)
		}
	}

	// 默认不应该出现 UTC 或「北京时间」前缀
	for _, banned := range []string{"UTC", "北京时间", "GMT"} {
		if strings.Contains(html, banned) {
			t.Errorf("HTML should not contain %q by default", banned)
		}
	}

	// XSS hardening: untrusted text must be escaped before reaching the markup.
	xss := RenderVerificationCodeHTML(VerificationCodeParams{
		Brand:       "<script>alert(1)</script>",
		SignoffText: "<img src=x onerror=alert(1)>",
		Code:        "000000",
		ExpiresAt:   params.ExpiresAt,
		HelpURL:     `javascript:alert(1)`,
	})
	if strings.Contains(xss, "<script>alert(1)</script>") {
		t.Error("brand not HTML-escaped")
	}
	if !strings.Contains(xss, "&lt;script&gt;") {
		t.Error("brand should appear as &lt;script&gt;")
	}
	if strings.Contains(xss, "<img src=x onerror=alert(1)>") {
		t.Error("signoff not HTML-escaped")
	}

	// 显式传 TimezoneLabel 时仍生效（例如海外用户）
	custom := RenderVerificationCodeHTML(VerificationCodeParams{
		Brand:         "Acme",
		Code:          "111111",
		ExpiresAt:     params.ExpiresAt,
		TimezoneLabel: "Tokyo",
	})
	if !strings.Contains(custom, "Tokyo 2026-08-08") {
		t.Errorf("custom TimezoneLabel not honored: missing 'Tokyo 2026-08-08' in:\n%s", custom)
	}
}

func TestRenderVerificationCodePreviewHTMLUsesOfficialLogoDataURL(t *testing.T) {
	preview := RenderVerificationCodePreviewHTML(VerificationCodeParams{
		Code:      "123456",
		ExpiresAt: time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC),
	})
	if !strings.Contains(preview, `src="data:image/png;base64,iVBORw0K`) {
		t.Fatalf("preview did not embed the official browser-compatible PNG: %s", preview)
	}
	if strings.Contains(preview, "cid:axi-workbench-logo@axi.local") {
		t.Error("browser preview should not contain an unresolved cid: URL")
	}
}

func TestRenderVerificationCodeText(t *testing.T) {
	params := VerificationCodeParams{
		Brand:     "Axi Workbench",
		Purpose:   "login",
		Code:      "654321",
		ExpiresAt: time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC),
	}
	text := RenderVerificationCodeText(params)
	for _, needle := range []string{"Axi Workbench", "654321", "过期时间：", "登录", "验证码"} {
		if !strings.Contains(text, needle) {
			t.Errorf("text missing %q", needle)
		}
	}
	// 默认不应该有时区前缀
	for _, banned := range []string{"UTC", "北京时间", "GMT"} {
		if strings.Contains(text, banned) {
			t.Errorf("text should not contain %q by default", banned)
		}
	}
}

func TestPurposeHuman(t *testing.T) {
	cases := map[string]string{
		"login":       "登录",
		"signup":      "注册",
		"reset":       "密码重置",
		"verify":      "验证",
		"":            "验证",
		"unknown-foo": "unknown-foo",
	}
	for in, want := range cases {
		if got := purposeHuman(in); got != want {
			t.Errorf("purposeHuman(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestFormatLocal(t *testing.T) {
	shanghai, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		t.Skip("Asia/Shanghai tzdata missing")
	}
	utc := time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC)

	// Default = 空 label → bare local time, no prefix.
	got := formatLocal(utc, shanghai, "")
	if got != "2026-08-08 20:00" {
		t.Errorf("formatLocal default = %q, want %q", got, "2026-08-08 20:00")
	}

	// 显式传 "Tokyo" 应保留
	got = formatLocal(utc, shanghai, "Tokyo")
	if !strings.Contains(got, "Tokyo") || !strings.Contains(got, "2026-08-08 20:00") {
		t.Errorf("formatLocal with Tokyo = %q", got)
	}

	// Nil location → UTC，ISO-8601 格式
	got = formatLocal(utc, nil, "")
	if got != "2026-08-08 12:00" {
		t.Errorf("formatLocal UTC nil-loc = %q, want %q", got, "2026-08-08 12:00")
	}
}
