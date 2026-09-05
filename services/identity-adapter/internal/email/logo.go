package email

import (
	_ "embed"
	"encoding/base64"
)

// brandLogoContentID is the MIME identifier used by the verification HTML.
const brandLogoContentID = "axi-workbench-logo@axi.local"

// brandLogoPNG is the exact four-leaf Axi Workbench source asset. It is copied
// byte-for-byte from apps/workbench/src/assets/logo-axi-core-color.png so the
// email never redraws, recolors, crops, or reinterprets the brand mark.
//
// A CID PNG is used instead of an SVG because QQ Mail and other email clients
// reliably display inline PNG attachments. CSS gives the original square asset
// its display size while the client performs the final high-quality scale.
//
//go:embed assets/axi-workbench-clover.png
var brandLogoPNG []byte

var brandLogoDataURL = "data:image/png;base64," + base64.StdEncoding.EncodeToString(brandLogoPNG)

// BrandLogoInlineAsset returns a defensive copy of the exact four-leaf brand
// asset for a multipart/related email part.
func BrandLogoInlineAsset() InlineAsset {
	return InlineAsset{
		ContentID:   brandLogoContentID,
		ContentType: "image/png",
		Filename:    "axi-workbench-clover.png",
		Data:        append([]byte(nil), brandLogoPNG...),
	}
}

// BrandLogoDataURL is used only by the local browser preview command.
func BrandLogoDataURL() string {
	return brandLogoDataURL
}
