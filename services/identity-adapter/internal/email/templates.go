package email

import (
	"fmt"
	"strings"
	"time"
)

// VerificationCodeParams captures everything the email template needs.
// Kept as a struct so future flows (password reset, device approval, etc.)
// can re-use the same renderer without re-implementing the markup.
type VerificationCodeParams struct {
	Brand         string // "Axi Workbench"
	LogoGlyph     string // reserved for a text-only fallback
	LogoColor     string // card accent color (default #10A37F)
	Recipient     string
	Purpose       string // "login" / "signup" / "reset"
	Code          string // 6-digit code, plain text
	ExpiresAt     time.Time
	Location      *time.Location // display timezone for ExpiresAt (defaults to Asia/Shanghai)
	TimezoneLabel string         // prefix label for ExpiresAt, e.g. "北京时间"
	HelpURL       string
	IgnoreNote    string // localizable copy
	SignoffText   string // localizable sign-off block
	TitleText     string // localizable card title
	CodeLabel     string // localizable "VERIFICATION CODE" label
	HelpText      string // localizable footer link text
}

// defaultBrandColor matches the soft sage-green used by OpenAI's verification
// emails. Override via VerificationCodeParams.LogoColor when re-skinning.
const defaultBrandColor = "#10A37F"

// RenderVerificationCodeHTML returns the HTML body for a 6-digit code email.
// Style aims at the ChatGPT / Linear / Vercel template family: a single white
// card on a soft gray background, big monospaced code in a light gray inner
// card, friendly copy around it. Delivered messages use the approved Axi
// four-color PNG as a CID attachment; the local preview uses the same asset as
// a data URL because browsers do not resolve email CIDs.
func RenderVerificationCodeHTML(p VerificationCodeParams) string {
	return renderVerificationCodeHTML(p, "cid:"+brandLogoContentID)
}

// RenderVerificationCodePreviewHTML renders the real approved logo for local
// browser inspection without changing the production email source.
func RenderVerificationCodePreviewHTML(p VerificationCodeParams) string {
	return renderVerificationCodeHTML(p, BrandLogoDataURL())
}

func renderVerificationCodeHTML(p VerificationCodeParams, logoSource string) string {
	if p.Brand == "" {
		p.Brand = "Axi Workbench"
	}
	if p.LogoColor == "" {
		p.LogoColor = defaultBrandColor
	}
	if p.Location == nil {
		p.Location, _ = time.LoadLocation("Asia/Shanghai")
	}
	// 默认不显示时区前缀：发件人已知道收件人在哪个时区，「北京时间」之类的措辞
	// 多余。需要给其它地区的收件人显示时，调用方显式传 TimezoneLabel（"Tokyo" 等）。
	if p.TimezoneLabel != "" && p.TimezoneLabel != "-" {
		// pass — caller-provided label is honored verbatim
	} else {
		p.TimezoneLabel = ""
	}
	if p.HelpURL == "" {
		p.HelpURL = "https://axi.workbench.dev/help"
	}
	if p.IgnoreNote == "" {
		p.IgnoreNote = "如果您没有请求此验证码，请忽略此邮件。"
	}
	if p.SignoffText == "" {
		p.SignoffText = "Axi Workbench 团队"
	}
	if p.TitleText == "" {
		p.TitleText = "您的验证码"
	}
	if p.CodeLabel == "" {
		p.CodeLabel = "验证码"
	}
	if p.HelpText == "" {
		p.HelpText = "帮助中心"
	}

	expires := formatLocal(p.ExpiresAt, p.Location, p.TimezoneLabel)
	purposeLabel := purposeHuman(p.Purpose)
	intro := fmt.Sprintf(
		"请在 %s 前输入以下 %d 位验证码以继续您的 %s。",
		expires, len(p.Code), purposeLabel,
	)

	brandColor := htmlEscape(p.LogoColor)

	var b strings.Builder
	b.WriteString(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>`)
	b.WriteString(htmlEscape(p.Brand + " 验证码"))
	b.WriteString(`</title>
<style>
  body { margin: 0; padding: 0; background: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Helvetica, Arial, sans-serif; color: #1d1d1f; -webkit-font-smoothing: antialiased; }
  .container { width: 100%; padding: 40px 16px; }
  .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04); overflow: hidden; }
  .accent { height: 4px; background: `)
	b.WriteString(brandColor)
	b.WriteString(`; }
  .header { padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #f0f0f3; }
  .logo-img { display: block; margin: 0 auto 12px; width: 56px; height: 56px; object-fit: contain; }
  .brand { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.01em; color: #1d1d1f; }
  .body { padding: 36px 32px 8px; text-align: center; }
  .title-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0 0 12px; }
  .title { margin: 0; font-size: 20px; font-weight: 600; color: #1d1d1f; letter-spacing: -0.01em; }
  .title-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; background: #ECFDF5; color: `)
	b.WriteString(brandColor)
	b.WriteString(`; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
  .intro { margin: 0 0 28px; font-size: 15px; line-height: 1.7; color: #4a4a4f; }
  .code-card { background: #F7FBF9; border: 1px solid #DCF2E7; border-radius: 12px; padding: 32px 24px; margin: 0 0 28px; }
  /* 邮件客户端会移除脚本；这里让验证码一键全选，保留客户端原生复制行为。 */
  .code { margin: 0; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 40px; font-weight: 700; letter-spacing: 0.32em; color: #2F9E68; cursor: text; user-select: all; -webkit-user-select: all; }
  .note { margin: 0 0 28px; font-size: 13px; line-height: 1.7; color: #86868b; }
  .signoff { margin: 0 0 8px; font-size: 14px; line-height: 1.7; color: #4a4a4f; }
  .footer { padding: 20px 32px 28px; border-top: 1px solid #f0f0f3; text-align: center; }
  .footer-brand { font-size: 12px; color: #86868b; }
  .footer-link { margin-top: 4px; font-size: 12px; color: #86868b; }
  .footer-link a { color: `)
	b.WriteString(brandColor)
	b.WriteString(`; text-decoration: none; }
  @media (max-width: 540px) {
    .container { padding: 16px 8px; }
    .card { border-radius: 10px; }
    .body { padding: 28px 20px 8px; }
    .code { font-size: 32px; letter-spacing: 0.22em; }
    .title-row { flex-direction: column; gap: 6px; }
  }
</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="accent"></div>
      <div class="header">
        `)
	b.WriteString(renderLogo(logoSource))
	b.WriteString(`
        <h1 class="brand">`)
	b.WriteString(htmlEscape(p.Brand))
	b.WriteString(`</h1>
      </div>
      <div class="body">
        <div class="title-row">
          <h2 class="title">`)
	b.WriteString(htmlEscape(p.TitleText))
	b.WriteString(`</h2>
          <span class="title-badge">`)
	b.WriteString(htmlEscape(p.CodeLabel))
	b.WriteString(`</span>
        </div>
        <p class="intro">`)
	b.WriteString(htmlEscape(intro))
	b.WriteString(`</p>
        <div class="code-card">
          <p class="code">`)
	b.WriteString(htmlEscape(p.Code))
	b.WriteString(`</p>
        </div>
        <p class="note">`)
	b.WriteString(htmlEscape(p.IgnoreNote))
	b.WriteString(`</p>
        <p class="signoff">`)
	b.WriteString(htmlEscape(p.SignoffText))
	b.WriteString(`</p>
      </div>
      <div class="footer">
        <div class="footer-brand">`)
	b.WriteString(htmlEscape(p.Brand))
	b.WriteString(`</div>
        <div class="footer-link"><a href="`)
	b.WriteString(htmlEscape(p.HelpURL))
	b.WriteString(`">`)
	b.WriteString(htmlEscape(p.HelpText))
	b.WriteString(`</a></div>
      </div>
    </div>
  </div>
</body>
</html>`)
	return b.String()
}

// renderLogo references a supplied source so production can use CID while
// local preview keeps the same approved PNG visible in a browser.
func renderLogo(logoSource string) string {
	return `<img class="logo-img" src="` + htmlEscape(logoSource) + `" width="56" height="56" alt="Axi Workbench four-color logo" style="display:block;margin:0 auto 12px;width:56px;height:56px;object-fit:contain;">`
}

// RenderVerificationCodeText returns the plain-text fallback body.
func RenderVerificationCodeText(p VerificationCodeParams) string {
	if p.Brand == "" {
		p.Brand = "Axi Workbench"
	}
	if p.Location == nil {
		p.Location, _ = time.LoadLocation("Asia/Shanghai")
	}
	// 默认不显示时区前缀：发件人已知道收件人在哪个时区，「北京时间」之类的措辞
	// 多余。需要给其它地区的收件人显示时，调用方显式传 TimezoneLabel（"Tokyo" 等）。
	if p.TimezoneLabel != "" && p.TimezoneLabel != "-" {
		// pass — caller-provided label is honored verbatim
	} else {
		p.TimezoneLabel = ""
	}
	expires := formatLocal(p.ExpiresAt, p.Location, p.TimezoneLabel)
	purposeLabel := purposeHuman(p.Purpose)

	var b strings.Builder
	fmt.Fprintf(&b, "%s 验证码\n\n", p.Brand)
	fmt.Fprintf(&b, "请在 %s 前输入以下 %d 位验证码以继续您的 %s：\n\n", expires, len(p.Code), purposeLabel)
	fmt.Fprintf(&b, "        %s\n\n", p.Code)
	fmt.Fprintf(&b, "过期时间：%s\n\n", expires)
	fmt.Fprintf(&b, "如果您没有请求此验证码，请忽略此邮件。\n\n")
	fmt.Fprintf(&b, "%s\n", "Axi Workbench 团队")
	return b.String()
}

// formatLocal renders ExpiresAt in the given location with a friendly local
// time string. Defaults to "北京时间 ..." prefix when the location is
// Asia/Shanghai; falls back to UTC + ISO-8601 if the location is nil. The
// caller is expected to wire `Location` and `TimezoneLabel` correctly so the
// recipient never has to parse a "UTC±N" suffix.
func formatLocal(t time.Time, loc *time.Location, label string) string {
	if loc == nil {
		loc = time.UTC
	}
	local := t.In(loc)
	formatted := local.Format("2006-01-02 15:04")
	if label == "" {
		return formatted
	}
	return fmt.Sprintf("%s %s", label, formatted)
}

func purposeHuman(purpose string) string {
	switch strings.ToLower(strings.TrimSpace(purpose)) {
	case "login":
		return "登录"
	case "signup":
		return "注册"
	case "reset", "password-reset":
		return "密码重置"
	case "verify", "verification":
		return "验证"
	default:
		if purpose == "" {
			return "验证"
		}
		return purpose
	}
}

func htmlEscape(value string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
		"'", "&#39;",
	)
	return replacer.Replace(value)
}
