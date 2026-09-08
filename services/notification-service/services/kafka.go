package services

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/segmentio/kafka-go"
	"notification-service/config"
	"notification-service/models"
)

const (
	kafkaMaxMessageBytes = 4 * 1024 * 1024
	kafkaMinBackoff      = time.Second
	kafkaMaxBackoff      = 30 * time.Second
)

// KafkaEventConsumer is an optional event-ingestion path. The HTTP gateway
// path remains the default; this consumer only exists when brokers are
// explicitly configured.
type KafkaEventConsumer struct {
	reader  *kafka.Reader
	service *NotificationService
}

// NewKafkaEventConsumer returns nil when Kafka is not configured, preserving
// the current PostgreSQL Outbox/HTTP contract in development and small
// deployments.
func NewKafkaEventConsumer(cfg *config.Config, service *NotificationService) (*KafkaEventConsumer, error) {
	brokers := splitKafkaBrokers(cfg.KafkaBrokers)
	if len(brokers) == 0 {
		return nil, nil
	}
	if strings.TrimSpace(cfg.KafkaTopic) == "" || strings.TrimSpace(cfg.KafkaGroupID) == "" {
		return nil, errors.New("Kafka topic and group ID are required when brokers are configured")
	}
	return &KafkaEventConsumer{
		reader: kafka.NewReader(kafka.ReaderConfig{
			Brokers:  brokers,
			GroupID:  cfg.KafkaGroupID,
			Topic:    cfg.KafkaTopic,
			MinBytes: 1,
			MaxBytes: kafkaMaxMessageBytes,
			MaxWait:  500 * time.Millisecond,
		}),
		service: service,
	}, nil
}

// Run fetches one message at a time and commits only after the event inbox
// transaction succeeds. A malformed message is committed after logging so a
// poison record cannot block the entire consumer group.
func (c *KafkaEventConsumer) Run(ctx context.Context) error {
	if c == nil {
		return nil
	}
	backoff := kafkaMinBackoff
	for {
		message, err := c.reader.FetchMessage(ctx)
		if err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return nil
			}
			if !waitKafkaBackoff(ctx, backoff) {
				return nil
			}
			backoff = minDuration(backoff*2, kafkaMaxBackoff)
			continue
		}
		backoff = kafkaMinBackoff

		event, err := decodeKafkaEvent(message)
		if err != nil {
			log.Printf("discarding malformed Kafka notification event at offset %d: %v", message.Offset, err)
			if err := c.reader.CommitMessages(ctx, message); err != nil {
				return err
			}
			continue
		}
		if _, err := c.service.ConsumeEventContext(ctx, event); err != nil {
			log.Printf("Kafka notification event %s was not persisted: %v", event.ID, err)
			if !waitKafkaBackoff(ctx, backoff) {
				return nil
			}
			backoff = minDuration(backoff*2, kafkaMaxBackoff)
			continue
		}
		if err := c.reader.CommitMessages(ctx, message); err != nil {
			return err
		}
	}
}

func (c *KafkaEventConsumer) Close() error {
	if c == nil || c.reader == nil {
		return nil
	}
	return c.reader.Close()
}

func decodeKafkaEvent(message kafka.Message) (*models.OutboxEvent, error) {
	var event models.OutboxEvent
	if err := json.Unmarshal(message.Value, &event); err != nil {
		return nil, err
	}
	if strings.TrimSpace(event.ID) == "" {
		event.ID = strings.TrimSpace(string(message.Key))
	}
	if strings.TrimSpace(event.ID) == "" || strings.TrimSpace(event.Topic) == "" {
		return nil, errors.New("Kafka event requires id and topic")
	}
	return &event, nil
}

func splitKafkaBrokers(value string) []string {
	brokers := make([]string, 0)
	for _, item := range strings.Split(value, ",") {
		if broker := strings.TrimSpace(item); broker != "" {
			brokers = append(brokers, broker)
		}
	}
	return brokers
}

func waitKafkaBackoff(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func minDuration(left, right time.Duration) time.Duration {
	if left < right {
		return left
	}
	return right
}
