package com.ecodesk;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class EcodeskApplication {
    public static void main(String[] args) {
        SpringApplication.run(EcodeskApplication.class, args);
    }
}
