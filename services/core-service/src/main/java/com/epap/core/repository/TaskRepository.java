package com.epap.core.repository;

import com.epap.core.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByProjectId(Long projectId);
    List<Task> findByStatus(Task.TaskStatus status);
    List<Task> findByPriority(Task.TaskPriority priority);
}
