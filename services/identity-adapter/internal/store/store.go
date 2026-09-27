package store

import (
	"context"
	"errors"

	"github.com/axi-workbench/identity-adapter/internal/model"
)

var (
	ErrNotFound          = errors.New("identity record not found")
	ErrInvalidState      = errors.New("identity transaction is not in the expected state")
	ErrExpired           = errors.New("identity transaction has expired")
	ErrAlreadyConsumed   = errors.New("identity credential has already been consumed")
	ErrInvalidCredential = errors.New("identity credential is invalid")
	ErrTooManyAttempts   = errors.New("identity credential has too many attempts")
)

// Store is the persistence boundary. Implementations only receive hashes of
// browser, QR, and email credentials, never the raw credentials themselves.
type Store interface {
	CreateQRTransaction(context.Context, model.QRTransaction) error
	GetQRTransaction(context.Context, string) (model.QRTransaction, error)
	ApproveQRTransaction(context.Context, string, string, string) (model.QRTransaction, error)
	BeginQRResume(context.Context, string, string, string) (model.QRTransaction, error)
	ConsumeQRResume(context.Context, string, string) (model.QRTransaction, error)

	CreateEmailVerification(context.Context, model.EmailVerification) error
	ConsumeEmailVerification(context.Context, string, string, string) (model.EmailVerification, error)

	UpsertEPSIdentityLink(context.Context, model.EPSIdentityLink) (model.EPSIdentityLink, error)
	GetEPSIdentityLink(context.Context, string, string) (model.EPSIdentityLink, error)
	Ping(context.Context) error
	Close()
}
