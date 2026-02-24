package com.epap.core.service;

import com.epap.core.model.Project;
import com.epap.core.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;

    @Transactional(readOnly = true)
    public List<Project> findAll() {
        return projectRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Project> findById(Long id) {
        return projectRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public List<Project> findByStatus(Project.ProjectStatus status) {
        return projectRepository.findByStatus(status);
    }

    @Transactional(readOnly = true)
    public List<Project> searchByName(String name) {
        return projectRepository.findByNameContainingIgnoreCase(name);
    }

    @Transactional
    public Project create(Project project) {
        return projectRepository.save(project);
    }

    @Transactional
    public Project update(Long id, Project project) {
        return projectRepository.findById(id)
                .map(existing -> {
                    existing.setName(project.getName());
                    existing.setDescription(project.getDescription());
                    existing.setStatus(project.getStatus());
                    return projectRepository.save(existing);
                })
                .orElseThrow(() -> new RuntimeException("Project not found with id: " + id));
    }

    @Transactional
    public void delete(Long id) {
        projectRepository.deleteById(id);
    }
}
