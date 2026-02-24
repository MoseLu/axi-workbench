package repository

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
	"epap/auth-service/models"
)

var (
	ErrUserNotFound    = errors.New("user not found")
	ErrUserAlreadyUsed = errors.New("email already in use")
)

type UserRepository interface {
	Create(user *models.User) error
	FindByEmail(email string) (*models.User, error)
	FindByID(id uuid.UUID) (*models.User, error)
}

type InMemoryUserRepository struct {
	mu    sync.RWMutex
	users map[string]*models.User
}

func NewInMemoryUserRepository() *InMemoryUserRepository {
	return &InMemoryUserRepository{
		users: make(map[string]*models.User),
	}
}

func (r *InMemoryUserRepository) Create(user *models.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.users[user.Email]; exists {
		return ErrUserAlreadyUsed
	}

	user.ID = uuid.New()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	r.users[user.Email] = user

	return nil
}

func (r *InMemoryUserRepository) FindByEmail(email string) (*models.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	user, exists := r.users[email]
	if !exists {
		return nil, ErrUserNotFound
	}

	return user, nil
}

func (r *InMemoryUserRepository) FindByID(id uuid.UUID) (*models.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, user := range r.users {
		if user.ID == id {
			return user, nil
		}
	}

	return nil, ErrUserNotFound
}
