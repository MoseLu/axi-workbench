use anyhow::{bail, Context, Result};
use keyring::Entry;

const SERVICE: &str = "com.axi.coder";
const LEGACY_SERVICE: &str = "com.axi-coder.app";

#[derive(Debug, Clone)]
pub struct SecretStore {
    service: String,
}

impl SecretStore {
    pub fn new() -> Self {
        Self {
            service: SERVICE.to_string(),
        }
    }

    pub fn secret_ref_for_provider(provider_id: &str) -> String {
        format!("provider:{provider_id}")
    }

    pub fn set(&self, secret_ref: &str, value: &str) -> Result<()> {
        let entry = Entry::new(&self.service, secret_ref)
            .with_context(|| format!("为 {secret_ref} 创建钥匙串条目失败。"))?;
        entry
            .set_password(value)
            .with_context(|| format!("存储 {secret_ref} 的钥匙串密钥失败。"))
    }

    pub fn get(&self, secret_ref: &str) -> Result<String> {
        let mut errors = Vec::new();

        for service in self.service_names() {
            let entry = match Entry::new(service, secret_ref) {
                Ok(entry) => entry,
                Err(error) => {
                    errors.push(format!("{service}: {error}"));
                    continue;
                }
            };

            match entry.get_password() {
                Ok(value) => return Ok(value),
                Err(error) => errors.push(format!("{service}: {error}")),
            }
        }

        bail!("读取 {secret_ref} 的钥匙串密钥失败：{}", errors.join("; "))
    }

    #[allow(dead_code)]
    pub fn delete(&self, secret_ref: &str) -> Result<()> {
        for service in self.service_names() {
            if let Ok(entry) = Entry::new(service, secret_ref) {
                let _ = entry.delete_credential();
            }
        }

        Ok(())
    }

    fn service_names(&self) -> Vec<&str> {
        if self.service == LEGACY_SERVICE {
            vec![self.service.as_str()]
        } else {
            vec![self.service.as_str(), LEGACY_SERVICE]
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{SecretStore, LEGACY_SERVICE, SERVICE};

    #[test]
    fn checks_current_keychain_service_before_legacy_service() {
        let store = SecretStore::new();

        assert_eq!(store.service_names(), vec![SERVICE, LEGACY_SERVICE]);
    }
}
