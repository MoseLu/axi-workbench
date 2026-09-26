package com.workbench.mobile.data.repository

import com.workbench.mobile.data.api.dto.GatewaySessionResponse
import com.workbench.mobile.data.api.dto.GatewaySessionUser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NavBadgeSessionTest {
    @Test
    fun `does not create a fallback identity for an absent session`() {
        assertNull(authenticatedSubjectOrNull(null))
        assertNull(authenticatedSubjectOrNull("   \t"))
    }

    @Test
    fun `keeps only a trimmed authenticated subject`() {
        assertEquals("user-42", authenticatedSubjectOrNull("  user-42  "))
    }

    @Test
    fun `accepts badges only after gateway verifies the same subject`() {
        val valid = GatewaySessionResponse(
            authenticated = true,
            user = GatewaySessionUser(subject = "user-42")
        )
        assertEquals(true, isVerifiedGatewaySession("user-42", valid))
        assertEquals(false, isVerifiedGatewaySession("another-user", valid))
        assertEquals(false, isVerifiedGatewaySession("user-42", GatewaySessionResponse()))
    }
}
