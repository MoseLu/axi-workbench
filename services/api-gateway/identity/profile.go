package identity

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"unicode"
)

const (
	UsernameMinLength       = 3
	UsernameMaxLength       = 16
	GeneratedUsernameLength = 12
)

var ErrInvalidUsername = errors.New("invalid username")

type principalProfile struct {
	Username string `json:"username"`
}

func profileKey(subject string) string {
	hash := sha256.Sum256([]byte(strings.TrimSpace(subject)))
	return "axi:profile:" + hex.EncodeToString(hash[:])
}

func usernameLength(value string) int {
	return len([]rune(value))
}

func usernameSeparator(value rune) bool {
	return value == '.' || value == '_' || value == '-'
}

func validUsername(value string) bool {
	value = strings.TrimSpace(value)
	runes := []rune(value)
	if len(runes) < UsernameMinLength || len(runes) > UsernameMaxLength {
		return false
	}
	if !unicode.IsLetter(runes[0]) && !unicode.IsDigit(runes[0]) {
		return false
	}
	last := runes[len(runes)-1]
	if !unicode.IsLetter(last) && !unicode.IsDigit(last) {
		return false
	}
	previousSeparator := false
	for _, character := range runes {
		if unicode.IsLetter(character) || unicode.IsDigit(character) {
			previousSeparator = false
			continue
		}
		if !usernameSeparator(character) || previousSeparator {
			return false
		}
		previousSeparator = true
	}
	return true
}

func stableUsernameSuffix(seed string) string {
	hash := sha256.Sum256([]byte(strings.TrimSpace(seed)))
	return hex.EncodeToString(hash[:])[:3]
}

func generatedUsername(email, subject string) string {
	local := strings.TrimSpace(strings.SplitN(email, "@", 2)[0])
	local = strings.TrimSpace(strings.SplitN(local, "+", 2)[0])
	filtered := make([]rune, 0, len([]rune(local)))
	for _, character := range strings.ToLower(local) {
		if unicode.IsLetter(character) || unicode.IsDigit(character) || usernameSeparator(character) {
			filtered = append(filtered, character)
		}
	}
	base := strings.Trim(string(filtered), "._-")
	if len([]rune(base)) > GeneratedUsernameLength {
		suffix := stableUsernameSuffix(subject + "\x00" + email)
		return string([]rune(base)[:8]) + "-" + suffix
	}
	if validUsername(base) {
		return base
	}
	suffix := stableUsernameSuffix(subject + "\x00" + email)
	prefix := base
	if prefix == "" {
		prefix = "axi"
	}
	return prefix + "-" + suffix
}

func resolveUsername(candidate, email, subject string) string {
	candidate = strings.TrimSpace(candidate)
	if validUsername(candidate) {
		return candidate
	}
	return generatedUsername(email, subject)
}

// ResolvePrincipalProfile loads the server-side username and creates a bounded
// default on first sight of an authenticated subject. The browser may cache a
// copy for fast rendering, but the Gateway remains the source of truth.
func (s *Service) ResolvePrincipalProfile(ctx context.Context, principal Principal) (Principal, error) {
	principal.Subject = strings.TrimSpace(principal.Subject)
	principal.Email = strings.TrimSpace(principal.Email)
	if principal.Subject == "" {
		return Principal{}, ErrUnauthorized
	}
	raw, err := s.records.Get(ctx, profileKey(principal.Subject))
	if err == nil {
		var profile principalProfile
		if json.Unmarshal(raw, &profile) == nil && validUsername(profile.Username) {
			principal.Name = profile.Username
			return principal, nil
		}
	} else if !errors.Is(err, ErrRecordNotFound) {
		// Profile enrichment must not turn a valid bearer/development identity
		// into an authentication failure. Update operations remain strict, while
		// reads fall back to the bounded deterministic username.
		principal.Name = resolveUsername(principal.Name, principal.Email, principal.Subject)
		return principal, nil
	}
	principal.Name = resolveUsername(principal.Name, principal.Email, principal.Subject)
	encoded, err := json.Marshal(principalProfile{Username: principal.Name})
	if err != nil {
		return Principal{}, err
	}
	if err := s.records.SetPersistent(ctx, profileKey(principal.Subject), encoded); err != nil {
		principal.Name = resolveUsername(principal.Name, principal.Email, principal.Subject)
		return principal, nil
	}
	return principal, nil
}

func (s *Service) UpdatePrincipalUsername(ctx context.Context, principal Principal, username string) (Principal, error) {
	username = strings.TrimSpace(username)
	if principal.Subject == "" || !validUsername(username) {
		return Principal{}, ErrInvalidUsername
	}
	encoded, err := json.Marshal(principalProfile{Username: username})
	if err != nil {
		return Principal{}, err
	}
	if err := s.records.SetPersistent(ctx, profileKey(principal.Subject), encoded); err != nil {
		return Principal{}, ErrSessionStoreUnavailable
	}
	principal.Name = username
	return principal, nil
}
