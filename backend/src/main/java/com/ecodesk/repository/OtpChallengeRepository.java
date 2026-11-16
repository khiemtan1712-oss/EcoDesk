package com.ecodesk.repository;

import com.ecodesk.entity.OtpChallenge;
import com.ecodesk.entity.OtpPurpose;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface OtpChallengeRepository extends JpaRepository<OtpChallenge, String> {

    Optional<OtpChallenge> findTopByEmailAndPurposeAndUsedFalseAndInvalidatedFalseOrderByCreatedAtDesc(
            String email, OtpPurpose purpose);

    Optional<OtpChallenge> findTopByEmailAndPurposeOrderByCreatedAtDesc(String email, OtpPurpose purpose);

    List<OtpChallenge> findByEmailAndPurposeAndUsedFalseAndInvalidatedFalse(String email, OtpPurpose purpose);

    long countByEmailAndPurposeAndCreatedAtAfter(String email, OtpPurpose purpose, Instant since);
}

