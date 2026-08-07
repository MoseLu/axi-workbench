package config

import "testing"

func TestValidateRequiresDurableConfiguration(t *testing.T) {
	tests := []struct {
		name       string
		config     Config
		wantErr    bool
		wantPhrase string
	}{
		{
			name: "missing internal token",
			config: Config{
				Environment: "production",
				DatabaseURL: "postgres://notification",
			},
			wantErr:    true,
			wantPhrase: "INTERNAL_SERVICE_TOKEN",
		},
		{
			name: "development missing database",
			config: Config{
				Environment:          "development",
				InternalServiceToken: "secret",
			},
			wantErr:    true,
			wantPhrase: "DATABASE_URL",
		},
		{
			name: "production configuration",
			config: Config{
				Environment:          "production",
				InternalServiceToken: "secret",
				DatabaseURL:          "postgres://notification",
			},
		},
		{
			name: "Kafka requires topic and group",
			config: Config{
				KafkaBrokers: "kafka:9092",
				KafkaTopic:   "",
				KafkaGroupID: "",
				DatabaseURL:  "postgres://notification",
			},
			wantErr:    true,
			wantPhrase: "KAFKA_TOPIC",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if tt.wantErr && err == nil {
				t.Fatal("Validate() returned nil error")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("Validate() returned unexpected error: %v", err)
			}
			if err != nil && tt.wantPhrase != "" && !contains(err.Error(), tt.wantPhrase) {
				t.Fatalf("error = %q, want phrase %q", err, tt.wantPhrase)
			}
		})
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
