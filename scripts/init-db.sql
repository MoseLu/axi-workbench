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
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'axi_workflow_app') THEN
    CREATE ROLE axi_workflow_app LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'axi_workflow_dev';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'axi_workflow_migrator') THEN
    CREATE ROLE axi_workflow_migrator LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'axi_workflow_migrator_dev';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'axi_notification_app') THEN
    CREATE ROLE axi_notification_app LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'axi_notification_dev';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'axi_notification_migrator') THEN
    CREATE ROLE axi_notification_migrator LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'axi_notification_migrator_dev';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'axi_file_app') THEN
    CREATE ROLE axi_file_app LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'axi_file_dev';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'axi_file_migrator') THEN
    CREATE ROLE axi_file_migrator LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'axi_file_migrator_dev';
  END IF;
END
$$;

SELECT 'CREATE DATABASE axi_platform OWNER axi_platform_migrator'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'axi_platform')\gexec

SELECT 'CREATE DATABASE axi_identity OWNER axi_identity_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'axi_identity')\gexec

SELECT 'CREATE DATABASE axi_workflow OWNER axi_workflow_migrator'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'axi_workflow')\gexec

SELECT 'CREATE DATABASE axi_notifications OWNER axi_notification_migrator'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'axi_notifications')\gexec

SELECT 'CREATE DATABASE axi_files OWNER axi_file_migrator'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'axi_files')\gexec
