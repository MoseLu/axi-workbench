package main

import (
	"fmt"
	"os"
	"time"

	"github.com/axi-workbench/identity-adapter/internal/email"
)

func main() {
	params := email.VerificationCodeParams{
		Brand:     "Axi Workbench",
		Purpose:   "login",
		Code:      "632557",
		ExpiresAt: time.Now().UTC().Add(15 * time.Minute),
		HelpURL:   "https://axi.workbench.dev/help",
	}
	html := email.RenderVerificationCodePreviewHTML(params)
	text := email.RenderVerificationCodeText(params)
	if err := os.WriteFile("/tmp/axi-verification-email.html", []byte(html), 0o644); err != nil {
		fmt.Println("write err:", err)
		os.Exit(1)
	}
	if err := os.WriteFile("/tmp/axi-verification-email.txt", []byte(text), 0o644); err != nil {
		fmt.Println("write err:", err)
		os.Exit(1)
	}
	fmt.Println("HTML bytes:", len(html))
	fmt.Println("TXT  bytes:", len(text))
	fmt.Println("Wrote: /tmp/axi-verification-email.{html,txt}")
}
