# PUB-01 规划: 公网 Ingress 配置

**状态**: 规划完成
**日期**: 2026-09-14
**负责人**: Axi Workbench Platform Team

---

## 1. 当前状态分析

### 1.1 现有 Ingress 配置

现有 Helm Chart 中的 Ingress (`infra/helm/axi-workbench-platform/templates/ingress.yaml`):

```yaml
spec:
  ingressClassName: nginx
  rules:
    - host: workbench.axiomaticworld.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: axiom-workbench-platform-gateway
                port:
                  name: http
```

**局限性**:
- 仅暴露 `/api` 路径到 API Gateway
- 缺少 `/` 根路径到 Web 前端的路由
- Web 静态资源无法通过 Ingress 访问

### 1.2 相关配置参数

| 组件 | 配置项 | 当前值 |
|------|--------|--------|
| Gateway Service | `gateway.service.port` | 8080 |
| Web 生产域名 | `gateway.publicBaseURL` | `https://workbench.axiomaticworld.com` |
| Web 静态资源 | `apps/workbench/dist/` | Vite 构建产物 |
| CORS 允许源 | `gateway.cors.allowedOrigins` | `https://workbench.axiomaticworld.com` |

---

## 2. 问题识别

### 2.1 缺口分析

当前架构缺失:

```
[用户浏览器]
      │
      ▼
  HTTPS ──────────────────────────────────┐
      │                                   │
   /api ──► [API Gateway:8080] ──► [后端服务]
      │
      │
      │  ← 缺失
      ▼
   /   ──► [??? 无路由]
```

### 2.2 候选解决方案

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A: Nginx Sidecar** | 在 Gateway Pod 中挂载 Web 静态卷，Nginx 代理 `/` | 单一入口，共享生命周期 | 增大 Pod 资源，静态卷复杂度 |
| **B: 独立 Web Ingress** | 新增第二个 Ingress 指向独立 Web Service | 解耦部署，灵活扩展 | 多一个 Service 需要管理 |
| **C: 静态 Server** | Web 构建为容器，通过 Service 暴露 | 标准化 K8s 部署 | 需要构建/维护 Web 镜像 |
| **D: 外部 CDN** | `/` 由外部 CDN 回源到对象存储 | 边缘性能最佳 | 引入外部依赖 |
| **E: 路径分流** | 单个 Ingress，Nginx 处理 `/api` 和 `/` 分流 | 单一入口 | 需挂载静态卷到 Gateway |

---

## 3. 推荐方案

**推荐方案 E: 路径分流 + 静态卷**

理由:
1. 与现有 `nginx` IngressClass 一致
2. 保持单一外部入口
3. Gateway 已有 `/api` 路由，只需扩展静态资源服务
4. 避免引入外部 CDN 或独立镜像构建

---

## 4. 预期 Ingress 配置草案

### 4.1 完整 Ingress 配置

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: axiom-workbench-platform
  labels:
    app.kubernetes.io/name: axiom-workbench-platform
    app.kubernetes.io/component: ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/use-regex: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - workbench.axiomaticworld.com
      secretName: axiom-workbench-api-tls
  rules:
    - host: workbench.axiomaticworld.com
      http:
        paths:
          # /api/* → API Gateway
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: axiom-workbench-platform-gateway
                port:
                  number: 8080
          # /* → Web 静态资源 (SPA fallback)
          - path: /
            pathType: Prefix
            backend:
              service:
                name: axiom-workbench-platform-web
                port:
                  number: 80
---
# Web 静态资源 Service
apiVersion: v1
kind: Service
metadata:
  name: axiom-workbench-platform-web
  labels:
    app.kubernetes.io/name: axiom-workbench-platform
    app.kubernetes.io/component: web
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: axiom-workbench-platform
    app.kubernetes.io/component: web
  ports:
    - name: http
      port: 80
      targetPort: 8080
      protocol: TCP
---
# Web Deployment (Nginx + 静态资源)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: axiom-workbench-platform-web
  labels:
    app.kubernetes.io/name: axiom-workbench-platform
    app.kubernetes.io/component: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: axiom-workbench-platform
      app.kubernetes.io/component: web
  template:
    metadata:
      labels:
        app.kubernetes.io/name: axiom-workbench-platform
        app.kubernetes.io/component: web
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
          volumeMounts:
            - name: web-static
              mountPath: /usr/share/nginx/html
              readOnly: true
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 256Mi
          livenessProbe:
            httpGet:
              path: /index.html
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /index.html
              port: http
            initialDelaySeconds: 3
            periodSeconds: 5
      volumes:
        - name: web-static
          persistentVolumeClaim:
            claimName: axiom-workbench-web-static
---
# PVC 用于静态资源 (开发/测试) 或改用 ConfigMap/S3
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: axiom-workbench-web-static
spec:
  accessModes:
    - ReadOnlyMany
  resources:
    requests:
      storage: 1Gi
  storageClassName: standard
```

### 4.2 SPA 重写规则 (备选注解)

如果使用 Nginx Ingress 控制器，需要添加 SPA fallback 支持:

```yaml
annotations:
  nginx.ingress.kubernetes.io/configuration-snippet: |
    try_files $uri $uri/ /index.html;
```

或使用 `rewrite` 注解:

```yaml
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /$2
```

### 4.3 生产环境优化

**方案 A: 使用 ConfigMap 存储静态资源** (小规模)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: axiom-workbench-web-static
data:
  index.html: |
    <!DOCTYPE html>
    <html lang="zh-CN">
    ...
```

**方案 B: 使用 Init Container 从对象存储拉取** (推荐生产)

```yaml
initContainers:
  - name: fetch-static
    image: curlimages/curl:latest
    command:
      - sh
      - -c
      - |
        curl -s https://bucket.s3.amazonaws.com/workbench/latest/index.html -o /usr/share/nginx/html/index.html
        curl -s https://bucket.s3.amazonaws.com/workbench/latest/assets/ -o /usr/share/nginx/html/assets/
    volumeMounts:
      - name: web-static
        mountPath: /usr/share/nginx/html
```

**方案 C: 独立 Web Image** (CI/CD 友好)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

---

## 5. 部署检查清单

### 5.1 前置条件

- [ ] Kubernetes 集群已安装 nginx-ingress-controller
- [ ] cert-manager 已安装并配置 letsencrypt-prod ClusterIssuer
- [ ] DNS 记录 `workbench.axiomaticworld.com` 指向 Ingress IP

### 5.2 部署步骤

1. **构建 Web 静态资源**
   ```bash
   cd apps/workbench
   npm run build  # 输出到 dist/
   ```

2. **上传静态资源到存储**
   ```bash
   # 方案: S3
   aws s3 sync dist/ s3://axi-workbench-web/latest/ --delete

   # 或: 打包为 ConfigMap
   kubectl create configmap axiom-workbench-web-static --from-file=dist/ -n axiom-workbench
   ```

3. **应用 Ingress 配置**
   ```bash
   kubectl apply -f infra/helm/axi-workbench-platform/templates/ingress.yaml
   kubectl apply -f infra/helm/axi-workbench-platform/templates/web-deployment.yaml
   ```

4. **验证配置**
   ```bash
   curl -I https://workbench.axiomaticworld.com/
   curl -I https://workbench.axiomaticworld.com/api/v1/health
   ```

### 5.3 验收标准

| 检查项 | 预期结果 |
|--------|----------|
| `GET /` | HTTP 200, 返回 SPA index.html |
| `GET /api/v1/health` | HTTP 200, 返回 `{"status":"ok"}` |
| HTTPS 证书 | 有效, 由 Let's Encrypt 签发 |
| 静态资源加载 | CSS/JS/图片正常加载 |
| SPA 路由 | `/dashboard`, `/settings` 等路由正常 |

---

## 6. 后续任务

- [ ] **PUB-02**: 配置 Web 静态资源构建流程
- [ ] **PUB-03**: 配置 CI/CD 自动部署
- [ ] **PUB-04**: 配置 Web 容器健康检查

---

## 7. 参考文档

- NGINX Ingress Controller: https://kubernetes.github.io/ingress-nginx/
- cert-manager: https://cert-manager.io/docs/
- SPA on Kubernetes: https://kubernetes.io/docs/tutorials/stateless-application/expose-external-ip-address-singularity/
