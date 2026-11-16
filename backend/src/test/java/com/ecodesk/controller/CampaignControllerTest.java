package com.ecodesk.controller;

import com.ecodesk.config.SepayProperties;
import com.ecodesk.entity.Campaign;
import com.ecodesk.entity.Order;
import com.ecodesk.entity.Product;
import com.ecodesk.entity.User;
import com.ecodesk.repository.CampaignRepository;
import com.ecodesk.repository.OrderRepository;
import com.ecodesk.repository.ProductRepository;
import com.ecodesk.repository.UserRepository;
import com.ecodesk.service.RbacService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CampaignControllerTest {

    private Map<String, Campaign> campaignStore;
    private Map<String, Product> productStore;
    private Map<String, User> userStore;
    private Map<String, Order> orderStore;
    private MockMvc campaignMvc;
    private MockMvc orderMvc;

    @BeforeEach
    void setUp() {
        campaignStore = new LinkedHashMap<>();
        productStore = new LinkedHashMap<>();
        userStore = new LinkedHashMap<>();
        orderStore = new LinkedHashMap<>();

        // Setup Admin user
        User admin = new User();
        admin.setId("U_ADMIN");
        admin.setName("Admin");
        admin.setEmail("admin@ecodesk.vn");
        admin.setRole("admin");
        admin.setActive(true);
        userStore.put(admin.getId(), admin);

        // Setup test product
        Product prod = new Product();
        prod.setId("P001");
        prod.setName("Bàn nâng hạ thông minh");
        prod.setPrice(1000000.0);
        prod.setStock(50);
        productStore.put(prod.getId(), prod);

        CampaignRepository campaignRepo = (CampaignRepository) Proxy.newProxyInstance(
                CampaignRepository.class.getClassLoader(),
                new Class<?>[]{CampaignRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "findById" -> Optional.ofNullable(campaignStore.get((String) args[0]));
                    case "findAll" -> new ArrayList<>(campaignStore.values());
                    case "findByProductId" -> campaignStore.values().stream()
                            .filter(c -> Objects.equals(c.getProductId(), args[0]))
                            .toList();
                    case "findByCodeIgnoreCase" -> campaignStore.values().stream()
                            .filter(c -> c.getCode() != null && c.getCode().equalsIgnoreCase((String) args[0]))
                            .findFirst();
                    case "existsById" -> campaignStore.containsKey((String) args[0]);
                    case "deleteById" -> {
                        campaignStore.remove((String) args[0]);
                        yield null;
                    }
                    case "save" -> {
                        Campaign c = (Campaign) args[0];
                        campaignStore.put(c.getId(), c);
                        yield c;
                    }
                    default -> null;
                }
        );

        ProductRepository productRepo = (ProductRepository) Proxy.newProxyInstance(
                ProductRepository.class.getClassLoader(),
                new Class<?>[]{ProductRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "findById" -> Optional.ofNullable(productStore.get((String) args[0]));
                    case "existsById" -> productStore.containsKey((String) args[0]);
                    case "save" -> {
                        Product p = (Product) args[0];
                        productStore.put(p.getId(), p);
                        yield p;
                    }
                    default -> null;
                }
        );

        UserRepository userRepo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[]{UserRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "findById" -> Optional.ofNullable(userStore.get((String) args[0]));
                    default -> null;
                }
        );

        OrderRepository orderRepo = (OrderRepository) Proxy.newProxyInstance(
                OrderRepository.class.getClassLoader(),
                new Class<?>[]{OrderRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "findById" -> Optional.ofNullable(orderStore.get((String) args[0]));
                    case "save" -> {
                        Order o = (Order) args[0];
                        orderStore.put(o.getId(), o);
                        yield o;
                    }
                    default -> null;
                }
        );

        RbacService rbacService = new RbacService(userRepo);
        CampaignController campaignController = new CampaignController(campaignRepo, productRepo, rbacService);
        campaignMvc = MockMvcBuilders.standaloneSetup(campaignController).build();

        SepayProperties sepayProps = new SepayProperties("", "live", "v2", "", "MB", "MB Bank", "0123456789", "ECODESK", "DH", true, 15000L, 1);
        OrderController orderController = new OrderController(orderRepo, productRepo, userRepo, sepayProps, rbacService, campaignRepo);
        orderMvc = MockMvcBuilders.standaloneSetup(orderController).build();
    }

    @Test
    void createCampaign_persistsProductIdPercentAndValidatesCorrectly() throws Exception {
        String json = """
                {
                    "productId": "P001",
                    "name": "Sale Mùa Hè",
                    "type": "regular",
                    "percent": 25,
                    "startAt": "2026-11-20T00:00:00Z",
                    "endAt": "2026-11-25T23:59:59Z",
                    "active": true
                }
                """;

        campaignMvc.perform(post("/api/campaigns")
                        .header(RbacService.HEADER_USER_ID, "U_ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productId").value("P001"))
                .andExpect(jsonPath("$.percent").value(25.0))
                .andExpect(jsonPath("$.type").value("regular"))
                .andExpect(jsonPath("$.code").exists());

        assertEquals(1, campaignStore.size());
        Campaign saved = campaignStore.values().iterator().next();
        assertEquals("P001", saved.getProductId());
        assertEquals(25.0, saved.getPercent());
    }

    @Test
    void createCampaign_rejectsNonExistentProduct() throws Exception {
        String json = """
                {
                    "productId": "NON_EXISTING",
                    "name": "Sale Lỗi",
                    "type": "regular",
                    "percent": 20,
                    "startAt": "2026-11-20T00:00:00Z",
                    "endAt": "2026-11-25T23:59:59Z"
                }
                """;

        campaignMvc.perform(post("/api/campaigns")
                        .header(RbacService.HEADER_USER_ID, "U_ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createCampaign_rejectsPercentAboveCap() throws Exception {
        // Regular cap is 50%
        String json = """
                {
                    "productId": "P001",
                    "name": "Sale Vượt Mức",
                    "type": "regular",
                    "percent": 60,
                    "startAt": "2026-11-20T00:00:00Z",
                    "endAt": "2026-11-25T23:59:59Z"
                }
                """;

        campaignMvc.perform(post("/api/campaigns")
                        .header(RbacService.HEADER_USER_ID, "U_ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createCampaign_rejectsEndAtBeforeStartAt() throws Exception {
        String json = """
                {
                    "productId": "P001",
                    "name": "Sale Ngược Giờ",
                    "type": "regular",
                    "percent": 20,
                    "startAt": "2026-11-25T00:00:00Z",
                    "endAt": "2026-11-20T00:00:00Z"
                }
                """;

        campaignMvc.perform(post("/api/campaigns")
                        .header(RbacService.HEADER_USER_ID, "U_ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createCampaign_blocksOverlappingSchedulesForSameProduct() throws Exception {
        // 1st schedule: 2026-11-20 to 2026-11-25
        Campaign c1 = new Campaign();
        c1.setId("C1");
        c1.setProductId("P001");
        c1.setName("Sale Đợt 1");
        c1.setType("regular");
        c1.setPercent(20.0);
        c1.setStartAt("2026-11-20T00:00:00Z");
        c1.setEndAt("2026-11-25T00:00:00Z");
        c1.setActive(true);
        campaignStore.put(c1.getId(), c1);

        // 2nd schedule overlapping: 2026-11-22 to 2026-11-28 -> MUST return 409 Conflict
        String overlappingJson = """
                {
                    "productId": "P001",
                    "name": "Sale Trùng",
                    "type": "regular",
                    "percent": 30,
                    "startAt": "2026-11-22T00:00:00Z",
                    "endAt": "2026-11-28T00:00:00Z",
                    "active": true
                }
                """;

        campaignMvc.perform(post("/api/campaigns")
                        .header(RbacService.HEADER_USER_ID, "U_ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(overlappingJson))
                .andExpect(status().isConflict());
    }

    @Test
    void orderCreation_calculatesAuthoritativePriceFromActiveCampaign() throws Exception {
        // Create active campaign (now is between startAt and endAt)
        Instant now = Instant.now();
        Campaign activeSale = new Campaign();
        activeSale.setId("C_ACTIVE");
        activeSale.setProductId("P001");
        activeSale.setName("Flash Sale Đang Chạy");
        activeSale.setType("regular");
        activeSale.setPercent(20.0); // 20% off -> 1,000,000 becomes 800,000
        activeSale.setStartAt(now.minusSeconds(3600).toString());
        activeSale.setEndAt(now.plusSeconds(3600).toString());
        activeSale.setActive(true);
        campaignStore.put(activeSale.getId(), activeSale);

        // Client attempts to send fake price 500,000 (50% off)
        String orderJson = """
                {
                    "itemsJson": "[{\\"productId\\":\\"P001\\",\\"name\\":\\"Bàn nâng hạ\\",\\"quantity\\":2,\\"price\\":500000}]",
                    "subtotal": 1000000,
                    "total": 1000000
                }
                """;

        orderMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(orderJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.subtotal").value(1600000.0)) // 800,000 * 2 = 1,600,000 authoritative!
                .andExpect(jsonPath("$.total").value(1600000.0));
    }

    @Test
    void orderCreation_upcomingCampaignDoesNotApplyDiscount() throws Exception {
        // Create upcoming campaign in the future
        Instant now = Instant.now();
        Campaign upcomingSale = new Campaign();
        upcomingSale.setId("C_UPCOMING");
        upcomingSale.setProductId("P001");
        upcomingSale.setName("Sale Sắp Diễn Ra");
        upcomingSale.setType("regular");
        upcomingSale.setPercent(30.0);
        upcomingSale.setStartAt(now.plusSeconds(7200).toString()); // 2 hours from now
        upcomingSale.setEndAt(now.plusSeconds(86400).toString());
        upcomingSale.setActive(true);
        campaignStore.put(upcomingSale.getId(), upcomingSale);

        // Client submits order: must sell at full base price 1,000,000
        String orderJson = """
                {
                    "itemsJson": "[{\\"productId\\":\\"P001\\",\\"name\\":\\"Bàn nâng hạ\\",\\"quantity\\":1}]"
                }
                """;

        orderMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(orderJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.subtotal").value(1000000.0))
                .andExpect(jsonPath("$.total").value(1000000.0));
    }
}
