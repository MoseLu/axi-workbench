package com.workbench.mobile.ui.screens.scan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DevicePairingQrPayloadTest {
    @Test
    fun `parses only the explicit short lived mobile pairing QR format`() {
        val payload = parseDevicePairingQrPayload(
            """{"kind":"axi-mobile-pair-v1","webPairingId":"webpair_a8e4d721-388a-4b17-90fa-170a91dd9e4d","scanToken":"Q4TkWcT5OmmuZECnsYBEEipOFGT4K0J9pKX1vTcrdOw"}"""
        )

        assertEquals(
            DevicePairingQrPayload(
                kind = "axi-mobile-pair-v1",
                webPairingId = "webpair_a8e4d721-388a-4b17-90fa-170a91dd9e4d",
                scanToken = "Q4TkWcT5OmmuZECnsYBEEipOFGT4K0J9pKX1vTcrdOw"
            ),
            payload
        )
    }

    @Test
    fun `does not mistake a Web login QR or malformed bearer for a device pairing QR`() {
        assertNull(parseDevicePairingQrPayload("""{"qrCodeId":"login_1","signature":"sig"}"""))
        assertNull(
            parseDevicePairingQrPayload(
                """{"kind":"axi-mobile-pair-v1","webPairingId":"bad","scanToken":"short"}"""
            )
        )
    }

    @Test
    fun `parses only an explicit Web login QR with an opaque scanner bearer`() {
        val payload = parseWebLoginQrPayload(
            """{"kind":"axi-web-login-v1","webLoginId":"weblogin_a8e4d721-388a-4b17-90fa-170a91dd9e4d","scanToken":"Q4TkWcT5OmmuZECnsYBEEipOFGT4K0J9pKX1vTcrdOw"}"""
        )

        assertEquals(
            WebLoginQrPayload(
                kind = "axi-web-login-v1",
                webLoginId = "weblogin_a8e4d721-388a-4b17-90fa-170a91dd9e4d",
                scanToken = "Q4TkWcT5OmmuZECnsYBEEipOFGT4K0J9pKX1vTcrdOw"
            ),
            payload
        )
        assertNull(parseWebLoginQrPayload("""{"qrCodeId":"legacy-login","signature":"not-a-device-grant"}"""))
    }
}
