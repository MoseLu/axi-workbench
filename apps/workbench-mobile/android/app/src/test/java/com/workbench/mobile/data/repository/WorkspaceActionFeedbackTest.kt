package com.workbench.mobile.data.repository

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class WorkspaceActionFeedbackTest {
    @Test
    fun `keeps verification feedback user-readable without runtime implementation terms`() {
        val message = mobileActionSubmissionMessage("project_verification")

        assertEquals("已开始重新核验，完成后会更新项目状态。", message)
        assertFalse(message.contains("workflow", ignoreCase = true))
        assertFalse(message.contains("runtime", ignoreCase = true))
    }

    @Test
    fun `explains diagnosis as an approval-gated read-only operation`() {
        assertEquals(
            "已提交只读诊断申请，等待已配对设备审批。",
            mobileActionSubmissionMessage("project_diagnosis")
        )
    }
}
