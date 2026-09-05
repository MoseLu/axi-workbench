package com.workbench.mobile.data.auth

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.PublicKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

data class DevicePublicKey(
    val algorithm: String,
    val publicKeyHex: String
)

/**
 * Per-device ES256 identity for the control-plane pairing contract.
 * The private key is created in Android Keystore and never enters DataStore.
 */
object ControlPlaneCrypto {
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val KEY_ALIAS = "axi_workbench_mobile_control_plane_es256_v1"
    private const val LEGACY_KEY_ALIAS = "axi_workbench_mobile_control_plane_ed25519_v1"
    const val DEVICE_KEY_ALGORITHM = "ES256"

    fun ensureDevicePublicKey(): DevicePublicKey {
        val keyStore = keyStore()
        keyStore.getCertificate(KEY_ALIAS)?.publicKey?.let(::publicKeyHex)?.let {
            return DevicePublicKey(DEVICE_KEY_ALGORITHM, it)
        }

        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE_PROVIDER)
        generator.initialize(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .build()
        )
        return DevicePublicKey(DEVICE_KEY_ALGORITHM, publicKeyHex(generator.generateKeyPair().public))
    }

    fun hasDeviceKey(): Boolean = runCatching {
        keyStore().containsAlias(KEY_ALIAS)
    }.getOrDefault(false)

    fun deleteDeviceKey() {
        runCatching {
            keyStore().apply {
                deleteEntry(KEY_ALIAS)
                // An upgrade must not leave a stale, unusable Ed25519 alias.
                deleteEntry(LEGACY_KEY_ALIAS)
            }
        }
    }

    fun signNonce(nonce: String): String {
        val privateKey = keyStore().getKey(KEY_ALIAS, null) as? PrivateKey
            ?: error("设备密钥不可用，请重新配对")
        return signNonce(privateKey, nonce)
    }

    fun publicKeyHex(publicKey: PublicKey): String {
        val encoded = publicKey.encoded ?: error("无法导出设备公钥")
        require(publicKey.algorithm.equals(KeyProperties.KEY_ALGORITHM_EC, ignoreCase = true) && encoded.size in 64..256) {
            "设备密钥不是 P-256 EC"
        }
        return encoded.joinToString(separator = "") { byte -> "%02x".format(byte) }
    }

    fun signNonce(privateKey: PrivateKey, nonce: String): String {
        val signer = Signature.getInstance("SHA256withECDSA")
        signer.initSign(privateKey)
        signer.update(nonce.toByteArray(Charsets.UTF_8))
        return signer.sign().joinToString(separator = "") { byte -> "%02x".format(byte) }
    }

    private fun keyStore(): KeyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
}
