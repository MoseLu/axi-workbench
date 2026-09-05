package com.workbench.mobile.ui.screens.workspace

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.workbench.mobile.data.api.dto.MobileProjectAction
import com.workbench.mobile.data.api.dto.WorkspaceApproval
import com.workbench.mobile.data.repository.WorkspaceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class WorkspaceViewModel @Inject constructor(
    private val repository: WorkspaceRepository
) : ViewModel() {
    val state: StateFlow<com.workbench.mobile.data.repository.WorkspaceLoadState> = repository.state
    val actionStates = repository.actionStates

    init {
        ensureFresh()
    }

    /** 用户主动刷新：才显示“正在同步”反馈。 */
    fun refresh() {
        viewModelScope.launch { repository.refresh() }
    }

    /** 普通导航复用 30 秒内快照，过期时只静默刷新。 */
    fun ensureFresh() {
        viewModelScope.launch { repository.refreshIfStale() }
    }

    fun submitAction(projectId: String, action: MobileProjectAction) {
        viewModelScope.launch {
            repository.submitProjectAction(
                projectId = projectId,
                actionId = action.actionId,
                actionType = action.actionType
            )
        }
    }

    fun decideApproval(approval: WorkspaceApproval, decision: String) {
        viewModelScope.launch { repository.decideProjectApproval(approval, decision) }
    }
}
