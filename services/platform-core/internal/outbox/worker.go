package outbox

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/axi-workbench/platform-core/internal/model"
	"github.com/axi-workbench/platform-core/internal/store"
)

const (
	outboxBatchSize     = 20
	outboxEventIDHeader = "X-Axi-Event-ID"
	outboxAttemptHeader = "X-Axi-Delivery-Attempt"
)

// Worker delivers durable PostgreSQL outbox records through a narrow internal
// contract. It marks a record delivered only after the downstream service
// returns a successful response; failures are released for retry.
type Worker struct {
	Store     store.Store
	URL       string
	AuthToken string
	Interval  time.Duration
	Client    *http.Client
	Logger    *slog.Logger
}

func (w Worker) Run(ctx context.Context) error {
	if w.Store == nil || strings.TrimSpace(w.URL) == "" {
		return fmt.Errorf("outbox worker requires persistence and delivery URL")
	}
	if w.Interval <= 0 {
		w.Interval = 5 * time.Second
	}
	if w.Client == nil {
		w.Client = &http.Client{Timeout: 10 * time.Second}
	}
	if w.Logger == nil {
		w.Logger = slog.Default()
	}
	ticker := time.NewTicker(w.Interval)
	defer ticker.Stop()
	for {
		if err := w.deliverAvailable(ctx); err != nil && ctx.Err() == nil {
			w.Logger.Error("platform outbox delivery loop failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

func (w Worker) deliverAvailable(ctx context.Context) error {
	events, err := w.Store.ClaimOutbox(ctx, outboxBatchSize)
	if err != nil {
		return err
	}
	for _, event := range events {
		if err := w.deliver(ctx, event); err != nil {
			_ = w.Store.ReleaseOutbox(ctx, event.ID, err.Error())
			w.Logger.Warn("platform outbox event deferred", "eventID", event.ID, "topic", event.Topic, "error", err)
			continue
		}
		if err := w.Store.MarkOutboxDelivered(ctx, event.ID); err != nil {
			return err
		}
	}
	return nil
}

func (w Worker) deliver(ctx context.Context, event model.OutboxEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, w.URL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Axi-Event-Topic", event.Topic)
	// Consumers must persist this ID before side effects. Delivery is
	// deliberately at-least-once, so a crash after HTTP success cannot create a
	// duplicate external action when the consumer honors this idempotency key.
	request.Header.Set(outboxEventIDHeader, event.ID)
	request.Header.Set(outboxAttemptHeader, strconv.Itoa(event.Attempts))
	if w.AuthToken != "" {
		request.Header.Set("X-Axi-Internal-Token", w.AuthToken)
	}
	response, err := w.Client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("outbox consumer returned HTTP %d", response.StatusCode)
	}
	return nil
}
