package email

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"image/png"
	"strings"
	"testing"
)

// This checksum is intentionally the original Workbench four-leaf source
// asset, not a separately drawn approximation or a resized derivative.
const fourLeafLogoSourceSHA256 = "8be03cf34914c2996f43023548b7d927f47fee3a4271ef1ec4e0398708842b34"

func TestBrandLogoInlineAssetUsesExactFourLeafSourceAsset(t *testing.T) {
	asset := BrandLogoInlineAsset()
	if asset.ContentID != brandLogoContentID {
		t.Errorf("ContentID = %q, want %q", asset.ContentID, brandLogoContentID)
	}
	if asset.ContentType != "image/png" || asset.Filename != "axi-workbench-clover.png" {
		t.Errorf("unexpected asset metadata: %#v", asset)
	}
	img, err := png.Decode(bytes.NewReader(asset.Data))
	if err != nil {
		t.Fatalf("decode four-leaf Axi logo: %v", err)
	}
	if img.Bounds().Dx() != 1254 || img.Bounds().Dy() != 1254 {
		t.Errorf("logo dimensions = %dx%d, want 1254x1254", img.Bounds().Dx(), img.Bounds().Dy())
	}
	if got := fmt.Sprintf("%x", sha256.Sum256(asset.Data)); got != fourLeafLogoSourceSHA256 {
		t.Errorf("logo checksum = %s, want exact four-leaf source %s", got, fourLeafLogoSourceSHA256)
	}
	if !strings.HasPrefix(BrandLogoDataURL(), "data:image/png;base64,iVBORw0K") {
		t.Error("preview data URL does not contain the exact four-leaf PNG")
	}
}
