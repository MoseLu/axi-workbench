package com.epap.core.service;

import com.epap.core.model.Project;
import com.epap.core.model.Task;
import com.epap.core.repository.ProjectRepository;
import com.epap.core.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;

    @Transactional(readOnly = true)
    public List<Task> findAll() {
        return taskRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Task> findById(Long id) {
        return taskRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public List<Task> findByProjectId(Long projectId) {
        return taskRepository.findByProjectId(projectId);
    }

    @Transactional(readOnly = true)
    public List<Task> findByStatus(Task.TaskStatus status) {
        return taskRepository.findByStatus(status);
    }

    @Transactional(readOnly = true)
    public List<Task> findByPriority(Task.TaskPriority priority) {
        return taskRepository.findByPriority(priority);
    }

    @Transactional
    public Task create(Task task, Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found with id: " + projectId));
        task.setProject(project);
        return taskRepository.save(task);
    }

    @Transactional
    public Task update(Long id, Task task) {
        return taskRepository.findById(id)
                .map(existing -> {
                    existing.setTitle(task.getTitle());
                    existing.setDescription(task.getDescription());
                    existing.setStatus(task.getStatus());
                    existing.setPriority(task.getPriority());
                    return taskRepository.save(existing);
                })
                .orElseThrow(() -> new RuntimeException("Task not found with id: " + id));
    }

    @Transactional
    public void delete(Long id) {
        taskRepository.deleteById(id);
    }
}
