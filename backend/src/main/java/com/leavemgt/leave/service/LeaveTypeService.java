package com.leavemgt.leave.service;

import com.leavemgt.leave.dto.CreateLeaveTypeRequest;
import com.leavemgt.leave.dto.LeaveTypeDto;
import com.leavemgt.leave.entity.LeaveType;
import com.leavemgt.leave.repository.LeaveTypeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class LeaveTypeService {

    private final LeaveTypeRepository leaveTypeRepository;

    public LeaveTypeService(LeaveTypeRepository leaveTypeRepository) {
        this.leaveTypeRepository = leaveTypeRepository;
    }

    @Transactional(readOnly = true)
    public List<LeaveTypeDto> getActiveLeaveTypes() {
        return leaveTypeRepository.findAllByIsActiveTrue().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LeaveTypeDto> getAllLeaveTypes() {
        return leaveTypeRepository.findAll().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public LeaveTypeDto createLeaveType(CreateLeaveTypeRequest request) {
        if (leaveTypeRepository.existsByCode(request.getCode().toUpperCase().trim())) {
            throw new IllegalArgumentException("Leave type code already exists: " + request.getCode());
        }
        if (leaveTypeRepository.existsByName(request.getName().trim())) {
            throw new IllegalArgumentException("Leave type name already exists: " + request.getName());
        }

        LeaveType leaveType = LeaveType.builder()
                .name(request.getName().trim())
                .code(request.getCode().toUpperCase().trim())
                .description(request.getDescription())
                .isPaid(request.getIsPaid() != null ? request.getIsPaid() : true)
                .requiresAttachment(request.getRequiresAttachment() != null ? request.getRequiresAttachment() : false)
                .isActive(true)
                .build();

        LeaveType saved = leaveTypeRepository.save(leaveType);
        return mapToDto(saved);
    }

    @Transactional
    public LeaveTypeDto deactivateLeaveType(UUID id) {
        LeaveType leaveType = leaveTypeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Leave type not found with ID: " + id));
        leaveType.setIsActive(false);
        LeaveType saved = leaveTypeRepository.save(leaveType);
        return mapToDto(saved);
    }

    public LeaveTypeDto mapToDto(LeaveType lt) {
        return LeaveTypeDto.builder()
                .id(lt.getId())
                .name(lt.getName())
                .code(lt.getCode())
                .description(lt.getDescription())
                .isPaid(lt.getIsPaid())
                .requiresAttachment(lt.getRequiresAttachment())
                .isActive(lt.getIsActive())
                .build();
    }
}
