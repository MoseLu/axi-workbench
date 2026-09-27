package trust

import (
	"crypto/subtle"
	"net/http"
)

const (
	InternalTokenHeader = "X-Axi-Internal-Token"
	SubjectHeader       = "X-Axi-Subject"
)

func InternalRequest(r *http.Request, expectedToken string) bool {
	actual := r.Header.Get(InternalTokenHeader)
	if actual == "" || expectedToken == "" || len(actual) != len(expectedToken) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(actual), []byte(expectedToken)) == 1
}
