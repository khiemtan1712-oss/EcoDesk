package com.ecodesk.controller;

import com.ecodesk.entity.User;
import com.ecodesk.repository.UserRepository;
import com.ecodesk.service.DisposableEmailPolicy;
import com.ecodesk.service.PasswordHashService;
import com.ecodesk.service.RbacService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.lang.reflect.Proxy;
import java.util.*;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthControllerTest {

    @Test
    void login_upgradesLegacyPlaintextPasswordToBcryptAndOmitsPasswordInJson() throws Exception {
        Map<String, User> store = new LinkedHashMap<>();
        User legacy = new User();
        legacy.setId("U_LEGACY");
        legacy.setName("Admin");
        legacy.setEmail("admin@ecodesk.vn");
        legacy.setPassword("admin");
        legacy.setRole("admin");
        store.put(legacy.getId(), legacy);

        UserRepository repo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[]{UserRepository.class},
                (p, m, args) -> switch (m.getName()) {
                    case "findAll" -> new ArrayList<>(store.values());
                    case "findById" -> Optional.ofNullable(store.get((String) args[0]));
                    case "findByEmail" -> store.values().stream()
                            .filter(u -> u.getEmail().equalsIgnoreCase((String) args[0]))
                            .findFirst();
                    case "save" -> {
                        User u = (User) args[0];
                        store.put(u.getId(), u);
                        yield u;
                    }
                    default -> Optional.empty();
                }
        );

        PasswordHashService hashService = new PasswordHashService();
        UserController controller = new UserController(repo, hashService, new DisposableEmailPolicy(), new RbacService(repo));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(controller).build();

        String body = new ObjectMapper().writeValueAsString(Map.of(
                "email", "admin@ecodesk.vn",
                "password", "admin"
        ));

        mvc.perform(post("/api/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("admin@ecodesk.vn"))
                .andExpect(jsonPath("$.password").doesNotExist());

        assertTrue(hashService.isBcryptHash(store.get("U_LEGACY").getPassword()));

        mvc.perform(get("/api/users").header("X-EcoDesk-User-Id", "U_LEGACY"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("$2a$"))))
                .andExpect(content().string(not(containsString("\"password\""))));
    }

    @Test
    void login_validatesBlankWrongPasswordAndUnverifiedAccounts() throws Exception {
        PasswordHashService hashService = new PasswordHashService();
        Map<String, User> store = new LinkedHashMap<>();

        User verified = new User();
        verified.setId("U_VER");
        verified.setName("Verified");
        verified.setEmail("ver@ecodesk.vn");
        verified.setPassword(hashService.hash("Secret@123"));
        verified.setEmailVerified(true);
        store.put(verified.getId(), verified);

        User unverified = new User();
        unverified.setId("U_UNVER");
        unverified.setName("Unverified");
        unverified.setEmail("unver@ecodesk.vn");
        unverified.setPassword(hashService.hash("Secret@123"));
        unverified.setEmailVerified(false);
        store.put(unverified.getId(), unverified);

        UserRepository repo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[]{UserRepository.class},
                (p, m, args) -> switch (m.getName()) {
                    case "findByEmail" -> store.values().stream()
                            .filter(u -> u.getEmail().equalsIgnoreCase((String) args[0]))
                            .findFirst();
                    default -> Optional.empty();
                }
        );

        UserController controller = new UserController(repo, hashService, new DisposableEmailPolicy(), new RbacService(repo));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(controller).build();
        ObjectMapper mapper = new ObjectMapper();

        mvc.perform(post("/api/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", "   ", "password", ""))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS_INPUT"));

        mvc.perform(post("/api/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", "ver@ecodesk.vn", "password", "WrongPass"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        mvc.perform(post("/api/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", "unver@ecodesk.vn", "password", "Secret@123"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
    }
}

