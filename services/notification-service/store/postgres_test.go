package store

import "testing"

func TestNotificationMigrationDefinesDurableInboxContract(t *testing.T) {
	for _, required := range []string{
		"CREATE SCHEMA IF NOT EXISTS axi_notifications",
		"CREATE TABLE IF NOT EXISTS axi_notifications.notifications",
		"user_id TEXT NOT NULL",
		"is_read BOOLEAN NOT NULL",
		"notifications_user_unread_idx",
		"CREATE TABLE IF NOT EXISTS axi_notifications.delivery_jobs",
		"notification_delivery_claim_idx",
		"CREATE TABLE IF NOT EXISTS axi_notifications.event_inbox",
		"notification_event_inbox_topic_idx",
	} {
		if !contains(initialMigration, required) {
			t.Fatalf("migration does not contain %q", required)
		}
	}
}

func contains(value, phrase string) bool {
	for i := 0; i+len(phrase) <= len(value); i++ {
		if value[i:i+len(phrase)] == phrase {
			return true
		}
	}
	return false
}
