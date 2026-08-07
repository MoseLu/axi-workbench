package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"epap/auth-service/middleware"
	"epap/auth-service/models"
	"epap/auth-service/repository"
)

const (
	defaultQrCodeTTL    = 60 * time.Second
	defaultPollInterval  = 1500 * time.Millisecond
)

type QrCodeHandler struct {
	qrRepo     repository.QrCodeRepository
	userRepo   repository.UserRepository
	jwtManager *middleware.JWTManager
	signSecret []byte
}

func NewQrCodeHandler(
	qrRepo repository.QrCodeRepository,
	userRepo repository.UserRepository,
	jwtManager *middleware.JWTManager,
	signSecret string,
) *QrCodeHandler {
	return &QrCodeHandler{
		qrRepo:     qrRepo,
		userRepo:   userRepo,
		jwtManager: jwtManager,
		signSecret: []byte(signSecret),
	}
}

type InitQrCodeRequest struct {
	ExpiresIn *int `json:"expiresIn,omitempty"`
}

type InitQrCodeResponse struct {
	QrCodeId        string `json:"qrCodeId"`
	QrCodePayload   string `json:"qrCodePayload"`
	QrCodeSignature string `json:"qrCodeSignature"`
	ExpiresAt       int64  `json:"expiresAt"`
	PollIntervalMs  int    `json:"pollIntervalMs"`
}

type ConfirmQrCodeRequest struct {
	QrCodeId   string `json:"qrCodeId" binding:"required"`
	Signature  string `json:"signature" binding:"required"`
	DeviceId   string `json:"deviceId" binding:"required"`
	Platform   string `json:"platform" binding:"required,oneof=ios android harmonyos"`
	AppVersion string `json:"appVersion,omitempty"`
}

type PollQrCodeResponse struct {
	QrCodeId string                `json:"qrCodeId"`
	Status   string                `json:"status"`
	User     *models.User          `json:"user,omitempty"`
	Tokens   *middleware.TokenPair `json:"tokens"`
}

// InitQrCode Web 端未登录调用 → 生成待扫码二维码
// 公开端点（无需 JWT）。二维码会话**不绑定任何用户**，等待 App 端 confirm 时再绑定。
func (h *QrCodeHandler) InitQrCode(c *gin.Context) {
	var req InitQrCodeRequest
	_ = c.ShouldBindJSON(&req)

	ttl := defaultQrCodeTTL
	if req.ExpiresIn != nil {
		ttl = time.Duration(*req.ExpiresIn) * time.Second
	}

	now := time.Now()
	qrId := uuid.NewString()
	expiresAt := now.Add(ttl)

	// Payload 内容：qrId + expiresAt（不含 userId，因为扫码时尚未绑定用户）
	payloadStruct := map[string]interface{}{
		"qrId":      qrId,
		"expiresAt": expiresAt.UnixMilli(),
		"issuedAt":  now.UnixMilli(),
		"purpose":   "web-login",
	}
	payloadJSON, _ := json.Marshal(payloadStruct)
	payloadB64 := base64.URLEncoding.EncodeToString(payloadJSON)

	// HMAC 签名（App 端需要回传，服务端比对）
	mac := hmac.New(sha256.New, h.signSecret)
	mac.Write([]byte(payloadB64))
	signature := base64.URLEncoding.EncodeToString(mac.Sum(nil))

	qr := &models.QrCode{
		ID:        qrId,
		UserID:    uuid.Nil, // 待 confirm 时绑定
		Payload:   payloadB64,
		Signature: signature,
		Status:    "pending",
		CreatedAt: now,
		ExpiresAt: expiresAt,
	}
	if err := h.qrRepo.Create(qr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create qrcode"})
		return
	}

	c.JSON(http.StatusOK, InitQrCodeResponse{
		QrCodeId:        qrId,
		QrCodePayload:   payloadB64,
		QrCodeSignature: signature,
		ExpiresAt:       expiresAt.UnixMilli(),
		PollIntervalMs:  int(defaultPollInterval / time.Millisecond),
	})
}

// PollQrCode Web 端轮询，公开端点
func (h *QrCodeHandler) PollQrCode(c *gin.Context) {
	qrId := c.Param("id")
	qr, err := h.qrRepo.FindByID(qrId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "qrcode not found"})
		return
	}

	resp := PollQrCodeResponse{
		QrCodeId: qr.ID,
		Status:   qr.Status,
		Tokens:   nil,
	}

	if qr.Status == "confirmed" && qr.UserID != uuid.Nil {
		// 一次性消费：poll 时立即标记 consumed
		qr.Status = "consumed"
		_ = h.qrRepo.Update(qr)

		user, err := h.userRepo.FindByID(qr.UserID)
		if err == nil {
			tokens, err := h.jwtManager.GenerateTokenPair(user.ID, user.Email)
			if err == nil {
				resp.Tokens = tokens
				resp.User = user
				resp.Status = "confirmed"
			}
		}
	}

	c.JSON(http.StatusOK, resp)
}

// ConfirmQrCode App 端调用：扫描到二维码 + 已登录用户 → 授权 Web 端以自己身份登录
// 需要 App 端 JWT 认证（从 Authorization header 取）
func (h *QrCodeHandler) ConfirmQrCode(c *gin.Context) {
	// 必须从 Authorization 头获取 App 用户身份
	authUserID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return
	}

	user, err := h.userRepo.FindByID(authUserID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	var req ConfirmQrCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	qr, err := h.qrRepo.FindByID(req.QrCodeId)
	if err != nil {
		if err == repository.ErrQrCodeNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "qrcode not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 校验状态
	if qr.Status == "expired" || qr.IsExpired() {
		qr.Status = "expired"
		_ = h.qrRepo.Update(qr)
		c.JSON(http.StatusGone, gin.H{"error": "qrcode expired"})
		return
	}
	if qr.Status != "pending" {
		c.JSON(http.StatusConflict, gin.H{"error": "qrcode not pending: " + qr.Status})
		return
	}

	// 验签：服务端重算 HMAC(Payload)，与 App 回传的 signature 常时间比较
	expectedMac := hmac.New(sha256.New, h.signSecret)
	expectedMac.Write([]byte(qr.Payload))
	expectedSig := base64.URLEncoding.EncodeToString(expectedMac.Sum(nil))
	if !hmac.Equal([]byte(req.Signature), []byte(expectedSig)) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	// 校验通过 → 把 QR 会话绑定到 App 当前用户
	now := time.Now()
	qr.UserID = user.ID
	qr.Status = "confirmed"
	qr.DeviceID = req.DeviceId
	qr.Platform = req.Platform
	qr.AppVersion = req.AppVersion
	qr.ConfirmedAt = &now
	if err := h.qrRepo.Update(qr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update qrcode"})
		return
	}

	// App 端立即拿到自己的 token（用于本地会话刷新）
	tokens, err := h.jwtManager.GenerateTokenPair(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user":   user.ToResponse(),
		"tokens": tokens,
	})
}