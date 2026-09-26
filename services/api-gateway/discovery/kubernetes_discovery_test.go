package discovery

import (
	"testing"
)

func TestParseCompoundName(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		wantNS    string
		wantSvc   string
		wantOK    bool
	}{
		{
			name:    "with namespace",
			input:   "default/my-service",
			wantNS:  "default",
			wantSvc: "my-service",
			wantOK:  true,
		},
		{
			name:    "with custom namespace",
			input:   "production/api-service",
			wantNS:  "production",
			wantSvc: "api-service",
			wantOK:  true,
		},
		{
			name:   "no namespace",
			input:  "my-service",
			wantNS: "",
			wantSvc: "",
			wantOK:  false,
		},
		{
			name:   "empty string",
			input:  "",
			wantNS: "",
			wantSvc: "",
			wantOK:  false,
		},
		{
			name:   "only slash",
			input:  "/",
			wantNS: "",
			wantSvc: "",
			wantOK:  false,
		},
		{
			name:   "slash only namespace",
			input:  "/my-service",
			wantNS: "",
			wantSvc: "",
			wantOK:  false,
		},
		{
			name:   "slash only service",
			input:  "default/",
			wantNS: "",
			wantSvc: "",
			wantOK:  false,
		},
		{
			name:    "nested namespace",
			input:   "default/sub/ns/my-service",
			wantNS:  "default/sub/ns",
			wantSvc: "my-service",
			wantOK:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotNS, gotSvc, gotOK := parseCompoundName(tt.input)
			if gotNS != tt.wantNS {
				t.Errorf("parseCompoundName() namespace = %v, want %v", gotNS, tt.wantNS)
			}
			if gotSvc != tt.wantSvc {
				t.Errorf("parseCompoundName() service = %v, want %v", gotSvc, tt.wantSvc)
			}
			if gotOK != tt.wantOK {
				t.Errorf("parseCompoundName() ok = %v, want %v", gotOK, tt.wantOK)
			}
		})
	}
}
