package main

import (
	"fmt"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"epap/auth-service/config"
	"epap/auth-service/handlers"
	"epap/auth-service/middleware"
	"epap/auth-service/repository"
)

func main() {
	cfg := config.Load()

	r := gin.Default()

	userRepo := repository.NewInMemoryUserRepository()
	qrRepo := repository.NewInMemoryQrCodeRepository()
	jwtManager := middleware.NewJWTManager(&cfg.JWT)
	authHandler := handlers.NewAuthHandler(userRepo, jwtManager)
	qrHandler := handlers.NewQrCodeHandler(qrRepo, userRepo, jwtManager, cfg.OAuthSecret)

	// 后台清理过期 QR 码（每 30 秒一次）
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			n := qrRepo.MarkExpired()
			if n > 0 {
				log.Printf("qrcode: marked %d as expired", n)
			}
		}
	}()

	api := r.Group("/api/v1")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
		}

		// QR 码扫码登录：
		//   init（公开）—— Web 端未登录调用，生成待扫码二维码
		//   poll（公开）—— Web 端轮询
		//   confirm（认证）—— App 端携带 JWT 确认，把会话绑定到 App 用户
		qrcodePublic := api.Group("/auth/qrcode")
		{
			qrcodePublic.POST("/init", qrHandler.InitQrCode)
			qrcodePublic.GET("/:id", qrHandler.PollQrCode)
		}

		qrcodeProtected := api.Group("/auth/qrcode")
		qrcodeProtected.Use(jwtManager.AuthMiddleware())
		{
			qrcodeProtected.POST("/confirm", qrHandler.ConfirmQrCode)
		}

		protected := api.Group("/")
		protected.Use(jwtManager.AuthMiddleware())
		{
			protected.GET("/me", authHandler.GetCurrentUser)
		}
	}

	addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
	log.Printf("Starting auth server on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}