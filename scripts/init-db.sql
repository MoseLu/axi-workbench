-- Local development bootstrap only. Production provisions identities and
-- credentials through Kubernetes secrets and the managed PostgreSQL service.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'axi_platform_app') THEN
    CREATE ROLE axi_platform_app LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'axi_platform_dev';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'axi_platform_migrator') THEN
    -- This role owns the RLS SECURITY DEFINER helpers. It is used only by the
    -- one-shot migration job, never by the running platform-core deployment.
    CREATE ROLE axi_platform_migrator LOGIN NOINHERIT BYPASSRLS PASSWORD 'axi_platform_migrator_dev';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'axi_identity_app') THEN
    CREATE ROLE axi_identity_app LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'axi_identity_dev';
  END IF;
END
$$;

SELECT 'CREATE DATABASE axi_platform OWNER axi_platform_migrator'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'axi_platform')\gexec

SELECT 'CREATE DATABASE axi_identity OWNER axi_identity_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'axi_identity')\gexec
