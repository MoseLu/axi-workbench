package com.workbench.mobile.data.network

import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GatewayEndpointTest {
    @Test
    fun `normalizes a LAN gateway origin to the sole api v1 ingress`() {
        assertEquals(
            "http://192.168.1.8:8088/api/v1/",
            normalizeGatewayBaseUrl(" http://192.168.1.8:8088 ")?.toString()
        )
        assertEquals(
            "https://workbench.example.test/api/v1/",
            normalizeGatewayBaseUrl("https://workbench.example.test/api/v1")?.toString()
        )
    }

    @Test
    fun `rejects direct control plane paths and unsafe URL components`() {
        assertNull(normalizeGatewayBaseUrl("http://192.168.1.8:8092/"))
        assertNull(normalizeGatewayBaseUrl("ftp://192.168.1.8:8088"))
        assertNull(normalizeGatewayBaseUrl("http://user@example.test:8088"))
        assertNull(normalizeGatewayBaseUrl("http://example.test:8088/api/v1?token=x"))
    }

    @Test
    fun `rewrites Retrofit placeholder routes through the configured gateway only`() {
        val endpoint = "http://192.168.1.8:8088/api/v1/".toHttpUrl()
        val placeholder = "http://axi.invalid/mobile/pair/start?debug=1".toHttpUrl()

        assertEquals(
            "http://192.168.1.8:8088/api/v1/mobile/pair/start?debug=1",
            rewriteGatewayRequestUrl(endpoint, placeholder).toString()
        )
    }

    @Test
    fun `requires an explicit LAN gateway when a physical device inherits the emulator-only default`() {
        val emulatorDefault = "http://10.0.2.2:8088/api/v1/".toHttpUrl()
        val lanGateway = "http://192.168.1.8:8088/api/v1/".toHttpUrl()

        assertTrue(requiresExplicitLanGateway(hasStoredEndpoint = false, defaultEndpoint = emulatorDefault, isEmulator = false))
        assertFalse(requiresExplicitLanGateway(hasStoredEndpoint = false, defaultEndpoint = emulatorDefault, isEmulator = true))
        assertFalse(requiresExplicitLanGateway(hasStoredEndpoint = true, defaultEndpoint = emulatorDefault, isEmulator = false))
        assertFalse(requiresExplicitLanGateway(hasStoredEndpoint = false, defaultEndpoint = lanGateway, isEmulator = false))
    }
}
