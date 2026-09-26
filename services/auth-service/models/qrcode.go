package models

import (
	"time"

	"github.com/google/uuid"
)

// QrCode 二维码登录会话
type QrCode struct {
	ID            string     `json:"id"`
	UserID        uuid.UUID  `json:"user_id"`         // Web 端用户（init 时绑定）
	Payload       string     `json:"payload"`         // base64 编码的 JSON {qrId,userId,expiresAt}
	Signature     string     `json:"signature"`       // HMAC-SHA256(Payload)，App 端回传用于验签
	Status        string     `json:"status"`          // pending / confirmed / consumed / expired
	DeviceID      string     `json:"device_id"`       // confirm 时填充
	Platform      string     `json:"platform"`        // android / ios / harmonyos
	AppVersion    string     `json:"app_version"`
	CreatedAt     time.Time  `json:"created_at"`
	ExpiresAt     time.Time  `json:"expires_at"`
	ConfirmedAt   *time.Time `json:"confirmed_at,omitempty"`
}

// IsExpired 判断是否过期
func (q *QrCode) IsExpired() bool {
	return time.Now().After(q.ExpiresAt)
}