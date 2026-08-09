// render-logo prints the approved four-color email logo as a browser data URL.
package main

import (
	"fmt"

	"github.com/axi-workbench/identity-adapter/internal/email"
)

func main() {
	fmt.Println(email.BrandLogoDataURL())
}
