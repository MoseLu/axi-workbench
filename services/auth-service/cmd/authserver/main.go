package main

import (
	"fmt"
	"log"

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
	jwtManager := middleware.NewJWTManager(&cfg.JWT)
	authHandler := handlers.NewAuthHandler(userRepo, jwtManager)

	api := r.Group("/api/v1")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
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
