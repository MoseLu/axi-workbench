package email

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"image/png"
	"strings"
	"testing"
)

// This checksum is intentionally the selected dango-family source asset, not
// a separately drawn approximation or a resized derivative.
const dangoFamilyLogoSourceSHA256 = "c6e6a64db2fd4951332870c30ee379d8d63af85e6c4219cdd576181f2c793202"

func TestBrandLogoInlineAssetUsesExactDangoFamilySourceAsset(t *testing.T) {
	asset := BrandLogoInlineAsset()
	if asset.ContentID != brandLogoContentID {
		t.Errorf("ContentID = %q, want %q", asset.ContentID, brandLogoContentID)
	}
	if asset.ContentType != "image/png" || asset.Filename != "axi-workbench-dango-family.png" {
		t.Errorf("unexpected asset metadata: %#v", asset)
	}
	img, err := png.Decode(bytes.NewReader(asset.Data))
	if err != nil {
		t.Fatalf("decode dango-family Axi logo: %v", err)
	}
	if img.Bounds().Dx() != 1254 || img.Bounds().Dy() != 1254 {
		t.Errorf("logo dimensions = %dx%d, want 1254x1254", img.Bounds().Dx(), img.Bounds().Dy())
	}
	if got := fmt.Sprintf("%x", sha256.Sum256(asset.Data)); got != dangoFamilyLogoSourceSHA256 {
		t.Errorf("logo checksum = %s, want exact dango-family source %s", got, dangoFamilyLogoSourceSHA256)
	}
	if !strings.HasPrefix(BrandLogoDataURL(), "data:image/png;base64,iVBORw0K") {
		t.Error("preview data URL does not contain the exact dango-family PNG")
	}
}
