package identity

import (
	"context"
	"testing"

	"github.com/epap/api-gateway/config"
)

func TestResolvePrincipalProfilePersistsBoundedDefaultAndUserUpdate(t *testing.T) {
	store := NewMemoryRecordStore(nil)
	service := NewForTest(config.IdentityConfig{}, store, nil, nil)
	principal := Principal{Subject: "subject-1", Email: "alexandria.long.lastname@icloud.com"}

	resolved, err := service.ResolvePrincipalProfile(context.Background(), principal)
	if err != nil {
		t.Fatalf("resolve generated profile: %v", err)
	}
	if resolved.Name != "alexandr-"+stableUsernameSuffix(principal.Subject+"\x00"+principal.Email) {
		t.Fatalf("generated username = %q", resolved.Name)
	}
	if !validUsername(resolved.Name) || usernameLength(resolved.Name) > GeneratedUsernameLength {
		t.Fatalf("generated username is not bounded: %q", resolved.Name)
	}

	updated, err := service.UpdatePrincipalUsername(context.Background(), resolved, "公理工作台")
	if err != nil {
		t.Fatalf("update profile: %v", err)
	}
	if updated.Name != "公理工作台" {
		t.Fatalf("updated username = %q", updated.Name)
	}

	restarted := NewForTest(config.IdentityConfig{}, store, nil, nil)
	reloaded, err := restarted.ResolvePrincipalProfile(context.Background(), Principal{Subject: principal.Subject, Email: principal.Email})
	if err != nil {
		t.Fatalf("reload profile: %v", err)
	}
	if reloaded.Name != "公理工作台" {
		t.Fatalf("persisted username = %q", reloaded.Name)
	}
}

func TestUpdatePrincipalUsernameRejectsOverlongAndMalformedValues(t *testing.T) {
	service := NewForTest(config.IdentityConfig{}, NewMemoryRecordStore(nil), nil, nil)
	principal := Principal{Subject: "subject-2", Email: "owner@axi.test"}
	for _, username := range []string{
		"ab",
		"a username",
		"a" + "aaaaaaaaaaaaaaaa",
		"-invalid",
	} {
		if _, err := service.UpdatePrincipalUsername(context.Background(), principal, username); err != ErrInvalidUsername {
			t.Fatalf("username %q error = %v, want ErrInvalidUsername", username, err)
		}
	}
}
