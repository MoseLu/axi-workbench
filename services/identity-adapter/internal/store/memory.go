package store

import (
	"context"
	"sync"
	"time"

	"github.com/axi-workbench/identity-adapter/internal/model"
)

type MemoryStore struct {
	mu       sync.Mutex
	qr       map[string]model.QRTransaction
	emails   map[string]model.EmailVerification
	epsLinks map[string]model.EPSIdentityLink
	now      func() time.Time
}

func NewMemory(now func() time.Time) *MemoryStore {
	if now == nil {
		now = time.Now
	}
	return &MemoryStore{
		qr:       make(map[string]model.QRTransaction),
		emails:   make(map[string]model.EmailVerification),
		epsLinks: make(map[string]model.EPSIdentityLink),
		now:      now,
	}
}

func (s *MemoryStore) CreateQRTransaction(_ context.Context, transaction model.QRTransaction) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.qr[transaction.ID] = transaction
	return nil
}

func (s *MemoryStore) GetQRTransaction(_ context.Context, id string) (model.QRTransaction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	transaction, ok := s.qr[id]
	if !ok {
		return model.QRTransaction{}, ErrNotFound
	}
	return transaction, nil
}

func (s *MemoryStore) ApproveQRTransaction(_ context.Context, id, ticketHash, subject string) (model.QRTransaction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	transaction, ok := s.qr[id]
	if !ok {
		return model.QRTransaction{}, ErrNotFound
	}
	if transaction.EffectiveStatus(s.now()) == model.QRExpired {
		return model.QRTransaction{}, ErrExpired
	}
	if transaction.Status != model.QRPending || transaction.TicketHash != ticketHash {
		return model.QRTransaction{}, ErrInvalidState
	}
	transaction.Status = model.QRApproved
	transaction.Subject = subject
	transaction.UpdatedAt = s.now()
	s.qr[id] = transaction
	return transaction, nil
}

func (s *MemoryStore) BeginQRResume(_ context.Context, id, pollTokenHash, resumeTokenHash string) (model.QRTransaction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	transaction, ok := s.qr[id]
	if !ok {
		return model.QRTransaction{}, ErrNotFound
	}
	if transaction.EffectiveStatus(s.now()) == model.QRExpired {
		return model.QRTransaction{}, ErrExpired
	}
	if transaction.Status != model.QRApproved || transaction.PollTokenHash != pollTokenHash {
		return model.QRTransaction{}, ErrInvalidState
	}
	transaction.Status = model.QRResuming
	transaction.ResumeTokenHash = resumeTokenHash
	transaction.UpdatedAt = s.now()
	s.qr[id] = transaction
	return transaction, nil
}

func (s *MemoryStore) ConsumeQRResume(_ context.Context, id, resumeTokenHash string) (model.QRTransaction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	transaction, ok := s.qr[id]
	if !ok {
		return model.QRTransaction{}, ErrNotFound
	}
	if transaction.EffectiveStatus(s.now()) == model.QRExpired {
		return model.QRTransaction{}, ErrExpired
	}
	if transaction.Status == model.QRConsumed {
		return model.QRTransaction{}, ErrAlreadyConsumed
	}
	if transaction.Status != model.QRResuming || transaction.ResumeTokenHash != resumeTokenHash {
		return model.QRTransaction{}, ErrInvalidState
	}
	transaction.Status = model.QRConsumed
	transaction.ResumeTokenHash = ""
	transaction.UpdatedAt = s.now()
	s.qr[id] = transaction
	return transaction, nil
}

func (s *MemoryStore) CreateEmailVerification(_ context.Context, verification model.EmailVerification) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.emails[verification.TokenHash] = verification
	return nil
}

func (s *MemoryStore) ConsumeEmailVerification(_ context.Context, tokenHash string) (model.EmailVerification, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	verification, ok := s.emails[tokenHash]
	if !ok {
		return model.EmailVerification{}, ErrNotFound
	}
	if verification.ConsumedAt != nil {
		return model.EmailVerification{}, ErrAlreadyConsumed
	}
	if s.now().After(verification.ExpiresAt) {
		return model.EmailVerification{}, ErrExpired
	}
	now := s.now()
	verification.ConsumedAt = &now
	s.emails[tokenHash] = verification
	return verification, nil
}

func (s *MemoryStore) UpsertEPSIdentityLink(_ context.Context, link model.EPSIdentityLink) (model.EPSIdentityLink, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := link.Provider + "\x00" + link.Subject
	if current, exists := s.epsLinks[key]; exists {
		link.CreatedAt = current.CreatedAt
	}
	s.epsLinks[key] = link
	return link, nil
}

func (s *MemoryStore) GetEPSIdentityLink(_ context.Context, provider, subject string) (model.EPSIdentityLink, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	link, ok := s.epsLinks[provider+"\x00"+subject]
	if !ok {
		return model.EPSIdentityLink{}, ErrNotFound
	}
	return link, nil
}

func (s *MemoryStore) Ping(context.Context) error { return nil }
func (s *MemoryStore) Close()                     {}
