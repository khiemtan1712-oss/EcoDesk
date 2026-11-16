package com.ecodesk.repository;

import com.ecodesk.entity.SepaySyncState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SepaySyncStateRepository extends JpaRepository<SepaySyncState, String> {
}

