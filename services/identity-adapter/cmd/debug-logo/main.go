// debug-logo writes the exact approved PNG attached to verification emails.
package main

import (
	"fmt"
	"os"

	"github.com/axi-workbench/identity-adapter/internal/email"
)

func main() {
	asset := email.BrandLogoInlineAsset()
	if err := os.WriteFile("/tmp/axi-logo-debug.png", asset.Data, 0o644); err != nil {
		fmt.Fprintln(os.Stderr, "write logo:", err)
		os.Exit(1)
	}
	fmt.Println("Wrote /tmp/axi-logo-debug.png")
}
