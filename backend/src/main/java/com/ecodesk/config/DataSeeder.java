package com.ecodesk.config;

import com.ecodesk.entity.*;
import com.ecodesk.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final CampaignRepository campaignRepository;
    private final BannerRepository bannerRepository;
    private final ReviewRepository reviewRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final FinancialTransactionRepository financialTransactionRepository;
    private final InventoryMovementRepository inventoryMovementRepository;
    private final PayrollRecordRepository payrollRecordRepository;
    private final ObjectMapper objectMapper;

    public DataSeeder(CategoryRepository categoryRepository,
                      ProductRepository productRepository,
                      UserRepository userRepository,
                      OrderRepository orderRepository,
                      CampaignRepository campaignRepository,
                      BannerRepository bannerRepository,
                      ReviewRepository reviewRepository,
                      PurchaseOrderRepository purchaseOrderRepository,
                      FinancialTransactionRepository financialTransactionRepository,
                      InventoryMovementRepository inventoryMovementRepository,
                      PayrollRecordRepository payrollRecordRepository) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
        this.campaignRepository = campaignRepository;
        this.bannerRepository = bannerRepository;
        this.reviewRepository = reviewRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.financialTransactionRepository = financialTransactionRepository;
        this.inventoryMovementRepository = inventoryMovementRepository;
        this.payrollRecordRepository = payrollRecordRepository;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    @Override
    public void run(String... args) {
        seedUsers();
        deduplicateAdminAccount();
        seedDataFromJson();
    }

    private void deduplicateAdminAccount() {
        userRepository.findById("U_ADMIN_01").ifPresent(dup -> {
            boolean hasOrderRef = orderRepository.findAll().stream().anyMatch(o ->
                    "U_ADMIN_01".equals(o.getUserId())
                            || "U_ADMIN_01".equals(o.getCancelledBy())
                            || "U_ADMIN_01".equals(o.getCancelRequestedBy())
                            || "U_ADMIN_01".equals(o.getCancelReviewedBy())
            );
            if (!hasOrderRef) {
                userRepository.delete(dup);
                System.out.println("✅ Đã xóa tài khoản admin trùng U_ADMIN_01 (giữ nguyên U_ADMIN).");
            } else {
                dup.setActive(false);
                dup.setHidden(true);
                dup.setEmail("disabled_u_admin_01@internal.ecodesk.vn");
                dup.setNote("Tài khoản trùng đã bị vô hiệu hóa để bảo toàn lịch sử");
                userRepository.save(dup);
                System.out.println("✅ Đã vô hiệu hóa & ẩn tài khoản admin trùng U_ADMIN_01 (giữ liên kết lịch sử).");
            }
        });
    }

    private void seedUsers() {
        Path usersPath = findFile("users.json");
        if (usersPath != null && usersPath.toFile().exists()) {
            try {
                JsonNode root = objectMapper.readTree(usersPath.toFile());
                if (root.isArray()) {
                    List<User> toCreate = new ArrayList<>();
                    for (JsonNode node : root) {
                        String id = node.path("id").asText("U_" + System.currentTimeMillis());
                        if ("U_ADMIN_01".equals(id)) continue;
                        String email = node.path("email").asText("").trim().toLowerCase();
                        if (email.isEmpty()) continue;
                        String pwd = node.path("password").asText("123456");

                        userRepository.findByEmail(email).ifPresentOrElse(existing -> {
                            if (node.has("password") && (existing.getPassword() == null || existing.getPassword().equals("123456") || existing.getPassword().equals("admin"))) {
                                existing.setPassword(pwd);
                                userRepository.save(existing);
                                System.out.println("✅ Đã cập nhật mật khẩu đồng bộ từ users.json cho: " + email);
                            }
                        }, () -> {
                            User u = new User();
                            u.setId(id);
                            u.setName(node.path("name").asText(""));
                            u.setEmail(email);
                            u.setPassword(pwd);
                            u.setRole(node.path("role").asText("customer"));
                            u.setPhone(node.path("phone").asText(""));
                            u.setCreatedAt(node.path("createdAt").asText(""));
                            u.setSpendTotal(node.path("spendTotal").asDouble(0.0));
                            u.setTier(node.path("tier").asText("Đồng"));
                            u.setNote(node.path("note").asText(""));
                            u.setActive(true);
                            u.setHidden(false);
                            if (node.has("emailVerified")) {
                                u.setEmailVerified(node.path("emailVerified").asBoolean(true));
                            } else {
                                u.setEmailVerified(true);
                            }
                            if (node.has("permissions") && node.get("permissions").isArray()) {
                                List<String> perms = new ArrayList<>();
                                for (JsonNode p : node.get("permissions")) {
                                    perms.add(p.asText());
                                }
                                u.setPermissions(perms);
                            }
                            toCreate.add(u);
                        });
                    }
                    if (!toCreate.isEmpty()) {
                        userRepository.saveAll(toCreate);
                        System.out.println("✅ Đã nạp " + toCreate.size() + " người dùng mới từ users.json vào cơ sở dữ liệu!");
                    }
                    return;
                }
            } catch (Exception e) {
                System.err.println("Lỗi đọc users.json: " + e.getMessage());
            }
        }

        // Fallback default admin
        User admin = new User();
        admin.setId("U_ADMIN");
        admin.setName("Quản trị viên EcoDesk");
        admin.setEmail("admin@ecodesk.vn");
        admin.setPassword("admin");
        admin.setRole("admin");
        admin.setPhone("0901234567");
        admin.setTier("Vàng");
        admin.setCreatedAt("2026-10-01T08:00:00.000Z");
        userRepository.save(admin);
        System.out.println("✅ Đã tạo tài khoản admin mặc định: admin@ecodesk.vn / admin");
    }

    private void seedDataFromJson() {
        Path dbPath = findFile("db.json");
        if (dbPath == null || !dbPath.toFile().exists()) return;

        try {
            JsonNode root = objectMapper.readTree(dbPath.toFile());

            // Đồng bộ nâng cấp biến thể cho sản phẩm trong MySQL
            if (root.has("products")) {
                for (JsonNode p : root.path("products")) {
                    String pId = p.path("id").asText();
                    if (!pId.isEmpty() && p.has("variants")) {
                        productRepository.findById(pId).ifPresentOrElse(existing -> {
                            if (existing.getVariantsJson() == null || existing.getVariantsJson().trim().isEmpty() || existing.getVariantsJson().equals("[]")) {
                                existing.setVariantsJson(p.path("variants").toString());
                                if (p.has("attributes")) {
                                    existing.setAttributesJson(p.path("attributes").toString());
                                }
                                productRepository.save(existing);
                                System.out.println("✅ Đã cập nhật biến thể cho sản phẩm " + pId + " trong MySQL!");
                            }
                        }, () -> {
                            Product prod = new Product();
                            prod.setId(pId);
                            prod.setName(p.path("name").asText(""));
                            prod.setPrice(p.path("price").asDouble(0.0));
                            prod.setCategoryId(p.path("categoryId").asText(""));
                            prod.setImage(p.path("image").asText(""));
                            prod.setDescription(p.path("description").asText(""));
                            prod.setStock(p.path("stock").asInt(10));
                            prod.setRating(p.path("rating").asDouble(0.0));
                            prod.setSold(p.path("sold").asInt(0));
                            prod.setStatus(p.path("status").asText("Còn hàng"));
                            prod.setCreatedAt(p.path("createdAt").asText("2026-10-01"));
                            prod.setVariantsJson(p.path("variants").toString());
                            if (p.has("attributes")) {
                                prod.setAttributesJson(p.path("attributes").toString());
                            }
                            productRepository.save(prod);
                            System.out.println("✅ Đã tạo mới sản phẩm " + pId + " với biến thể trong MySQL!");
                        });
                    }
                }
            }

            if (categoryRepository.count() > 0 && productRepository.count() > 0) return;

            // 1. Categories
            if (categoryRepository.count() == 0 && root.has("categories")) {
                List<Category> categories = new ArrayList<>();
                for (JsonNode c : root.path("categories")) {
                    categories.add(new Category(c.path("id").asText(), c.path("name").asText()));
                }
                categoryRepository.saveAll(categories);
                System.out.println("✅ Đã nạp " + categories.size() + " danh mục vào MySQL!");
            }

            // 2. Products
            if (productRepository.count() == 0 && root.has("products")) {
                List<Product> products = new ArrayList<>();
                for (JsonNode p : root.path("products")) {
                    Product prod = new Product();
                    prod.setId(p.path("id").asText("P" + System.currentTimeMillis()));
                    prod.setName(p.path("name").asText(""));
                    prod.setPrice(p.path("price").asDouble(0.0));
                    prod.setCategoryId(p.path("categoryId").asText(""));
                    prod.setImage(p.path("image").asText(""));
                    prod.setDescription(p.path("description").asText(""));
                    prod.setStock(p.path("stock").asInt(10));
                    prod.setRating(p.path("rating").asDouble(0.0));
                    prod.setSold(p.path("sold").asInt(0));
                    prod.setStatus(p.path("status").asText("Còn hàng"));
                    prod.setCreatedAt(p.path("createdAt").asText("2026-10-01"));

                    List<String> tags = new ArrayList<>();
                    if (p.has("tags") && p.path("tags").isArray()) {
                        for (JsonNode t : p.path("tags")) {
                            tags.add(t.asText());
                        }
                    }
                    prod.setTags(tags);
                    if (p.has("variants")) {
                        prod.setVariantsJson(p.path("variants").toString());
                    }
                    if (p.has("attributes")) {
                        prod.setAttributesJson(p.path("attributes").toString());
                    }
                    products.add(prod);
                }
                productRepository.saveAll(products);
                System.out.println("✅ Đã nạp " + products.size() + " sản phẩm vào MySQL!");
            }

            // 3. Campaigns
            if (campaignRepository.count() == 0 && root.has("campaigns")) {
                List<Campaign> campaigns = new ArrayList<>();
                for (JsonNode c : root.path("campaigns")) {
                    Campaign camp = new Campaign();
                    camp.setId(c.path("id").asText());
                    camp.setName(c.path("name").asText(""));
                    camp.setBadge(c.path("badge").asText(""));
                    camp.setCode(c.path("code").asText(""));
                    camp.setType(c.path("type").asText("percent"));
                    camp.setValue(c.path("value").asDouble(0.0));
                    camp.setMaxDiscount(c.path("maxDiscount").asDouble(0.0));
                    camp.setMinOrder(c.path("minOrder").asDouble(0.0));
                    camp.setActive(c.path("active").asBoolean(true));
                    camp.setStartAt(c.path("startAt").asText(""));
                    camp.setEndAt(c.path("endAt").asText(""));
                    camp.setDescription(c.path("description").asText(""));
                    campaigns.add(camp);
                }
                campaignRepository.saveAll(campaigns);
                System.out.println("✅ Đã nạp " + campaigns.size() + " chiến dịch khuyến mãi vào MySQL!");
            }

            // 4. Banners
            if (bannerRepository.count() == 0 && root.has("banners")) {
                List<Banner> banners = new ArrayList<>();
                for (JsonNode b : root.path("banners")) {
                    Banner banner = new Banner();
                    banner.setId(b.path("id").asText());
                    banner.setTitle(b.path("title").asText(""));
                    banner.setSubtitle(b.path("subtitle").asText(""));
                    banner.setBadge(b.path("badge").asText(""));
                    banner.setLink(b.path("link").asText(""));
                    banner.setImage(b.path("image").asText(""));
                    banner.setActive(b.path("active").asBoolean(true));
                    banners.add(banner);
                }
                bannerRepository.saveAll(banners);
                System.out.println("✅ Đã nạp " + banners.size() + " banner vào cơ sở dữ liệu!");
            }

            // 5. Orders
            if (orderRepository.count() == 0 && root.has("orders")) {
                List<Order> orders = new ArrayList<>();
                for (JsonNode o : root.path("orders")) {
                    try {
                        Order order = objectMapper.treeToValue(o, Order.class);
                        orders.add(order);
                    } catch (Exception ex) {
                        System.err.println("Lỗi nạp order: " + ex.getMessage());
                    }
                }
                if (!orders.isEmpty()) {
                    orderRepository.saveAll(orders);
                    System.out.println("✅ Đã nạp " + orders.size() + " đơn hàng vào cơ sở dữ liệu!");
                }
            }

            // 6. Reviews
            if (reviewRepository.count() == 0 && root.has("reviews")) {
                List<Review> reviews = new ArrayList<>();
                for (JsonNode r : root.path("reviews")) {
                    try {
                        Review rev = objectMapper.treeToValue(r, Review.class);
                        reviews.add(rev);
                    } catch (Exception ex) {
                        System.err.println("Lỗi nạp review: " + ex.getMessage());
                    }
                }
                if (!reviews.isEmpty()) {
                    reviewRepository.saveAll(reviews);
                    System.out.println("✅ Đã nạp " + reviews.size() + " đánh giá vào cơ sở dữ liệu!");
                }
            }

            // 7. Purchase Orders
            if (purchaseOrderRepository.count() == 0 && root.has("purchases")) {
                List<PurchaseOrder> purchases = new ArrayList<>();
                for (JsonNode po : root.path("purchases")) {
                    try {
                        PurchaseOrder p = objectMapper.treeToValue(po, PurchaseOrder.class);
                        purchases.add(p);
                    } catch (Exception ex) {
                        System.err.println("Lỗi nạp purchase order: " + ex.getMessage());
                    }
                }
                if (!purchases.isEmpty()) {
                    purchaseOrderRepository.saveAll(purchases);
                    System.out.println("✅ Đã nạp " + purchases.size() + " phiếu nhập kho vào cơ sở dữ liệu!");
                }
            }

            // 8. Financial Transactions
            if (financialTransactionRepository.count() == 0 && root.has("transactions")) {
                List<FinancialTransaction> txs = new ArrayList<>();
                for (JsonNode t : root.path("transactions")) {
                    try {
                        FinancialTransaction tx = objectMapper.treeToValue(t, FinancialTransaction.class);
                        txs.add(tx);
                    } catch (Exception ex) {
                        System.err.println("Lỗi nạp transaction: " + ex.getMessage());
                    }
                }
                if (!txs.isEmpty()) {
                    financialTransactionRepository.saveAll(txs);
                    System.out.println("✅ Đã nạp " + txs.size() + " giao dịch tài chính vào cơ sở dữ liệu!");
                }
            }

            // 9. Inventory Movements
            if (inventoryMovementRepository.count() == 0 && root.has("movements")) {
                List<InventoryMovement> movements = new ArrayList<>();
                for (JsonNode m : root.path("movements")) {
                    try {
                        InventoryMovement mov = objectMapper.treeToValue(m, InventoryMovement.class);
                        movements.add(mov);
                    } catch (Exception ex) {
                        System.err.println("Lỗi nạp inventory movement: " + ex.getMessage());
                    }
                }
                if (!movements.isEmpty()) {
                    inventoryMovementRepository.saveAll(movements);
                    System.out.println("✅ Đã nạp " + movements.size() + " biến động kho vào cơ sở dữ liệu!");
                }
            }

            // 10. Payroll Records
            if (payrollRecordRepository.count() == 0 && root.has("payrolls")) {
                List<PayrollRecord> payrolls = new ArrayList<>();
                for (JsonNode pr : root.path("payrolls")) {
                    try {
                        PayrollRecord p = objectMapper.treeToValue(pr, PayrollRecord.class);
                        payrolls.add(p);
                    } catch (Exception ex) {
                        System.err.println("Lỗi nạp payroll: " + ex.getMessage());
                    }
                }
                if (!payrolls.isEmpty()) {
                    payrollRecordRepository.saveAll(payrolls);
                    System.out.println("✅ Đã nạp " + payrolls.size() + " bảng lương vào cơ sở dữ liệu!");
                }
            }

        } catch (Exception e) {
            System.err.println("Lỗi đọc db.json: " + e.getMessage());
        }
    }

    private Path findFile(String filename) {
        Path p = Paths.get(filename);
        if (p.toFile().exists()) return p;
        p = Paths.get("..", filename);
        if (p.toFile().exists()) return p;
        p = Paths.get("backend", "..", filename);
        if (p.toFile().exists()) return p;
        return null;
    }
}
