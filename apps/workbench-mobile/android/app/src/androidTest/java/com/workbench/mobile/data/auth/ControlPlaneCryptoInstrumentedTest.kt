package com.workbench.mobile.data.auth

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ControlPlaneCryptoInstrumentedTest {
    @After
    fun clearDeviceKey() {
        ControlPlaneCrypto.deleteDeviceKey()
    }

    @Test
    fun createsAndUsesAnAndroidKeystoreEs256DeviceKey() {
        ControlPlaneCrypto.deleteDeviceKey()

        val deviceKey = ControlPlaneCrypto.ensureDevicePublicKey()
        val signatureHex = ControlPlaneCrypto.signNonce("android-keystore-nonce")

        assertTrue(ControlPlaneCrypto.hasDeviceKey())
        assertTrue(deviceKey.algorithm == "ES256")
        assertTrue(deviceKey.publicKeyHex.matches(Regex("[0-9a-f]{128,512}")))
        assertTrue(signatureHex.matches(Regex("[0-9a-f]{128,512}")))
    }
}
