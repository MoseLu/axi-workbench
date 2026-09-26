# Windows Reverse Proxy — Deployment Templates

Two interchangeable templates for serving the Axi Workbench backend
behind HTTPS on the Windows host (`DESKTOP-519U63K` /
`192.168.101.6`). Both implement the same single-entrypoint contract
from
`docs/deployment/REMOTE-WINDOWS-WORKBENCH-DEPLOYMENT-TODO.md` §7:

    https://workbench.axiomaticworld.com/
      /api/*   -> http://127.0.0.1:18088/api/*
      /health  -> http://127.0.0.1:18088/health
      /ready   -> http://127.0.0.1:18088/ready

## Files

| File | Use it when | Backing service |
| --- | --- | --- |
| `Caddyfile.workbench` | The Windows host has a clean 80/443. **Preferred.** | `caddy.exe` as a Windows service. |
| `nginx.workbench.conf` | IIS or another component already owns 80/443 and a sidecar Caddy is not acceptable. | `nginx.exe` Windows service. |

Both files use `__REPLACE_ME__` placeholders. **Do not** commit real
certificate paths, real ACME email, or any private keys to this
repository. The deploy owner copies the file to the Windows host,
fills the placeholders, and reloads the proxy.

## Required preconditions (human-supplied)

1. **Public IP / NAT.** The Windows host's public IPv4 address must be
   reachable on TCP 80 and 443. The router / firewall must forward
   80/443 to `192.168.101.6`. `workbench.axiomaticworld.com` A record
   must resolve to that public IP. Until this is true, DNS A record
   must NOT be repointed — see TODO §3 cutover rule.
2. **TLS certificate.** Either obtain one via ACME (Caddy's default
   path) or import an existing certificate into the host's certificate
   store. SAN must include `workbench.axiomaticworld.com` exactly.
3. **Windows firewall.** Only TCP 80 and 443 must be open on the
   public profile. Internal service ports (18088, 8092, 8081, 8082,
   8083, 8084, 8085, 15432, 16379) must remain on 127.0.0.1 only.

## Validation on the Windows host

Caddy:

```powershell
caddy validate --config C:\caddy\Caddyfile
caddy reload   --config C:\caddy\Caddyfile
```

nginx:

```powershell
nginx -t -c C:/nginx/conf/nginx.workbench.conf
nginx -s reload -c C:/nginx/conf/nginx.workbench.conf
```

End-to-end probe (use the Windows host first, then a separate network):

```powershell
# from the Windows host
curl.exe --fail-with-body https://workbench.axiomaticworld.com/health
# from the Mac, no proxy
curl --noproxy '*' --silent --show-error \
  https://workbench.axiomaticworld.com/health -w '\nhttp=%{http_code}\n'
# TLS chain check
openssl s_client -connect workbench.axiomaticworld.com:443 \
  -servername workbench.axiomaticworld.com < /dev/null
```

## Rollback

1. Stop the proxy service.
2. Restore the previous Caddyfile / nginx config from the Windows
   backup path documented in the deploy log.
3. Restart the proxy service.
4. Re-run the end-to-end probe. Failure here is the only signal that
   the rollback is incomplete.

Never roll back by deleting a TLS key, by editing DNS, or by stopping
the Docker compose stack. The proxy is the only layer in this
template that can be reverted without coordination with the upstream
services.
