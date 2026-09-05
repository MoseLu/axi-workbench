package model

import "time"

type QRStatus string

const (
	QRPending  QRStatus = "pending"
	QRApproved QRStatus = "approved"
	QRResuming QRStatus = "resuming"
	QRConsumed QRStatus = "consumed"
	QRExpired  QRStatus = "expired"
)

type QRTransaction struct {
	ID                  string
	TicketHash          string
	PollTokenHash       string
	ResumeTokenHash     string
	ClientID            string
	RedirectURI         string
	CodeChallenge       string
	CodeChallengeMethod string
	State               string
	Subject             string
	Status              QRStatus
	ExpiresAt           time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

func (t QRTransaction) EffectiveStatus(now time.Time) QRStatus {
	if now.After(t.ExpiresAt) && t.Status != QRConsumed {
		return QRExpired
	}
	return t.Status
}

type EmailVerification struct {
	ID          string
	ChallengeID string
	Email       string
	Purpose     string
	TokenHash   string
	Attempts    int
	MaxAttempts int
	ExpiresAt   time.Time
	ConsumedAt  *time.Time
	CreatedAt   time.Time
}

type EPSIdentityLink struct {
	Provider        string    `json:"provider"`
	ExternalSubject string    `json:"externalSubject"`
	Subject         string    `json:"subject"`
	OrganizationRef string    `json:"organizationRef,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}
