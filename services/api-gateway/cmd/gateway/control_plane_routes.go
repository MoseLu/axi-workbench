package main

import (
	"github.com/gin-gonic/gin"
)

// registerWebControlPlaneRoutes replaces the previous Any("/control-plane/*")
// catch-all. Only the Control Plane resources the Web session actually uses
// are reachable; CONNECT/TRACE and unknown paths fall through to 404.
func registerWebControlPlaneRoutes(protected *gin.RouterGroup, proxy gin.HandlerFunc) {
	protected.GET("/control-plane/snapshot", proxy)
	protected.GET("/control-plane/personal-os/queue", proxy)
	protected.GET("/control-plane/personal-os/projects/:id", proxy)
	protected.PATCH("/control-plane/personal-os/projects/:id", proxy)
	protected.GET("/control-plane/personal-os/focus", proxy)
	protected.PUT("/control-plane/personal-os/focus", proxy)
	protected.POST("/control-plane/query", proxy)
	protected.POST("/control-plane/communication/messages", proxy)
	protected.POST("/control-plane/jobs", proxy)
	protected.GET("/control-plane/jobs/:id", proxy)
	protected.GET("/control-plane/jobs/:id/events", proxy)
	protected.GET("/control-plane/jobs/:id/artifacts", proxy)
	protected.POST("/control-plane/jobs/:id/cancel", proxy)
	protected.POST("/control-plane/jobs/:id/cancellations", proxy)
	protected.GET("/control-plane/agent-tasks/:id", proxy)
	protected.POST("/control-plane/agent-tasks/:id/cancel", proxy)
	protected.POST("/control-plane/agent-tasks/:id/cancellations", proxy)
	protected.POST("/control-plane/approvals/:id/decision", proxy)
	protected.POST("/control-plane/approvals/:id/decisions", proxy)
	protected.POST("/control-plane/commands/:id/run", proxy)
	protected.POST("/control-plane/commands/:id/runs", proxy)
	protected.GET("/control-plane/runs/:id", proxy)
	protected.POST("/control-plane/mobile/pair-approval", proxy)
	protected.POST("/control-plane/mobile/pair/approve", proxy)
	protected.POST("/control-plane/mobile/pair/qr", proxy)
	protected.GET("/control-plane/mobile/pair/qr/:id", proxy)
	protected.POST("/control-plane/mobile/pair/qr/:id/approve", proxy)
}

// registerMobileControlRoutes replaces the previous Any("/mobile/*") catch-all.
// Device pairing, auth, workspace, jobs and approvals stay on the old RPC
// paths; noun aliases are registered next to them.
func registerMobileControlRoutes(v1 *gin.RouterGroup, proxy gin.HandlerFunc) {
	v1.POST("/mobile/pair/start", proxy)
	v1.POST("/mobile/pair/qr/scan", proxy)
	v1.POST("/mobile/web-login/qr/scan", proxy)
	v1.POST("/mobile/pair/confirm", proxy)
	v1.POST("/mobile/pair/confirmations", proxy)
	v1.POST("/mobile/pair/status", proxy)
	v1.POST("/mobile/pair/revoke", proxy)
	v1.POST("/mobile/pair/revocations", proxy)
	v1.POST("/mobile/auth/token", proxy)
	v1.POST("/mobile/auth/tokens", proxy)
	v1.POST("/mobile/auth/nonce", proxy)
	v1.POST("/mobile/auth/nonces", proxy)
	v1.POST("/mobile/auth/owner-token", proxy)
	v1.POST("/mobile/auth/owner-tokens", proxy)
	v1.GET("/mobile/workspace", proxy)
	v1.POST("/mobile/approval-scans/resolve", proxy)
	v1.POST("/mobile/approval-scans/:id/decision", proxy)
	v1.POST("/mobile/approval-scans/:id/decisions", proxy)
	v1.GET("/mobile/projects/:id", proxy)
	v1.POST("/mobile/jobs", proxy)
	v1.POST("/mobile/jobs/:id/cancel", proxy)
	v1.POST("/mobile/jobs/:id/cancellations", proxy)
	v1.POST("/mobile/approvals/:id/decision", proxy)
	v1.POST("/mobile/approvals/:id/decisions", proxy)
}
