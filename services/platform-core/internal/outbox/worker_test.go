package outbox

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/axi-workbench/platform-core/internal/model"
)

func TestDeliverProvidesStableIdempotencyHeaders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if got := request.Header.Get(outboxEventIDHeader); got != "event-123" {
			t.Errorf("event id header = %q", got)
		}
		if got := request.Header.Get(outboxAttemptHeader); got != "4" {
			t.Errorf("attempt header = %q", got)
		}
		if got := request.Header.Get("X-Axi-Event-Topic"); got != "task.created" {
			t.Errorf("topic header = %q", got)
		}
		_, _ = io.WriteString(writer, `{}`)
	}))
	defer server.Close()

	worker := Worker{URL: server.URL, Client: server.Client(), Logger: slog.Default()}
	if err := worker.deliver(t.Context(), model.OutboxEvent{ID: "event-123", Topic: "task.created", Attempts: 4, Payload: []byte(`{"id":"task-1"}`)}); err != nil {
		t.Fatalf("deliver() error = %v", err)
	}
}
