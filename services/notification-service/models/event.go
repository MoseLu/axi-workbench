package models

import "encoding/json"

// OutboxEvent is the narrow event envelope shared by Platform Core and its
// specialist consumers. Delivery is at-least-once; consumers must persist ID
// before applying any side effect.
type OutboxEvent struct {
	ID       string          `json:"id"`
	TenantID string          `json:"tenantId"`
	Topic    string          `json:"topic"`
	Payload  json.RawMessage `json:"payload"`
}
