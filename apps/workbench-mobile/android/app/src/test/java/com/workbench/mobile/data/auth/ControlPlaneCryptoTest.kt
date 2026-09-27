package com.workbench.mobile.data.auth

import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.spec.ECGenParameterSpec
import java.security.KeyPairGenerator
import java.security.Signature

class ControlPlaneCryptoTest {
    @Test
    fun `exports an ES256 SPKI public key and signs a nonce with its matching private key`() {
        val generator = KeyPairGenerator.getInstance("EC")
        generator.initialize(ECGenParameterSpec("secp256r1"))
        val keyPair = generator.generateKeyPair()
        val nonce = "nonce-for-control-plane"
        val publicKeyHex = ControlPlaneCrypto.publicKeyHex(keyPair.public)
        val signatureHex = ControlPlaneCrypto.signNonce(keyPair.private, nonce)

        assertTrue(publicKeyHex.matches(Regex("[0-9a-f]{128,512}")))
        assertTrue(signatureHex.matches(Regex("[0-9a-f]{128,512}")))
        val verifier = Signature.getInstance("SHA256withECDSA")
        verifier.initVerify(keyPair.public)
        verifier.update(nonce.toByteArray(Charsets.UTF_8))
        assertTrue(verifier.verify(signatureHex.hexToBytes()))
    }

    private fun String.hexToBytes(): ByteArray = chunked(2)
        .map { it.toInt(16).toByte() }
        .toByteArray()
}
