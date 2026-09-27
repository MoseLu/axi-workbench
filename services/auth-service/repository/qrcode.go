package repository

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
	"epap/auth-service/models"
)

var (
	ErrQrCodeNotFound      = errors.New("qrcode not found")
	ErrQrCodeExpired       = errors.New("qrcode expired")
	ErrQrCodeNotPending    = errors.New("qrcode not in pending state")
	ErrQrCodeAlreadyUsed   = errors.New("qrcode already consumed")
)

type QrCodeRepository interface {
	Create(qr *models.QrCode) error
	FindByID(id string) (*models.QrCode, error)
	Update(qr *models.QrCode) error
	// MarkExpired 异步 GC：将所有过期且 pending 的标记为 expired
	MarkExpired() int
}

type InMemoryQrCodeRepository struct {
	mu       sync.RWMutex
	codes    map[string]*models.QrCode
}

func NewInMemoryQrCodeRepository() *InMemoryQrCodeRepository {
	return &InMemoryQrCodeRepository{
		codes: make(map[string]*models.QrCode),
	}
}

func (r *InMemoryQrCodeRepository) Create(qr *models.QrCode) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if qr.ID == "" {
		qr.ID = uuid.NewString()
	}
	if qr.CreatedAt.IsZero() {
		qr.CreatedAt = time.Now()
	}
	if qr.Status == "" {
		qr.Status = "pending"
	}
	r.codes[qr.ID] = qr
	return nil
}

func (r *InMemoryQrCodeRepository) FindByID(id string) (*models.QrCode, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	qr, exists := r.codes[id]
	if !exists {
		return nil, ErrQrCodeNotFound
	}
	// 读时自动 lazy-expire
	if qr.Status == "pending" && qr.IsExpired() {
		qr.Status = "expired"
	}
	return qr, nil
}

func (r *InMemoryQrCodeRepository) Update(qr *models.QrCode) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.codes[qr.ID]; !exists {
		return ErrQrCodeNotFound
	}
	r.codes[qr.ID] = qr
	return nil
}

func (r *InMemoryQrCodeRepository) MarkExpired() int {
	r.mu.Lock()
	defer r.mu.Unlock()

	count := 0
	for _, qr := range r.codes {
		if qr.Status == "pending" && qr.IsExpired() {
			qr.Status = "expired"
			count++
		}
	}
	return count
}