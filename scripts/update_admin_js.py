with open('js/admin.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
import_stmt = 'import { initProductModal, openProductModal, closeProductModal } from "./admin-product-modal.js";\n'
if import_stmt not in content:
    content = import_stmt + content
    print("Added import for admin-product-modal.js")

# 2. Update renderInventoryTable line
old_inv_edit = '<a href="./edit.html?id=${escapeHtml(p.id)}" style="font-size: 12px; color: #15803d; font-weight: 600; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;">${renderIcon("settings", { size: 13, strokeWidth: 1.8 })} Sửa thông tin & biến thể trong Form</a>'
new_inv_edit = '<button type="button" class="btn-inventory-edit-variant" data-edit-product="${escapeHtml(p.id)}" style="background: none; border: none; padding: 0; font-size: 12px; color: #15803d; font-weight: 600; text-decoration: underline; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">${renderIcon("settings", { size: 13, strokeWidth: 1.8 })} Sửa thông tin &amp; biến thể</button>'

if old_inv_edit in content:
    content = content.replace(old_inv_edit, new_inv_edit, 1)
    print("Updated inventory table edit link.")
else:
    print("Warning: old_inv_edit not found.")

# 3. Update renderProductsTable line
old_prod_edit = '<a class="table-action-btn" href="./edit.html?id=${escapeHtml(p.id)}">Sửa</a>'
new_prod_edit = '<button class="table-action-btn" type="button" data-edit-product="${escapeHtml(p.id)}">Sửa</button>'

if old_prod_edit in content:
    content = content.replace(old_prod_edit, new_prod_edit, 1)
    print("Updated products table edit link.")
else:
    print("Warning: old_prod_edit not found.")

# 4. Replace old add product modal implementation
old_modal_start = '  // ==================== ADD PRODUCT MODAL ===================='
old_modal_end = '/* ==========================================================================\n   TAB 4: QUẢN LÝ DANH MỤC (CATEGORIES) - THÊM, SỬA, XÓA, EXCEL'

new_modal_code = '''  // ==================== PRODUCT MODAL (THÊM & SỬA SẢN PHẨM) ====================
  const openAddBtn = document.getElementById("openAddProductModalBtn");
  const overviewAddBtn = document.getElementById("overviewAddProductBtn");
  const navAddBtn = document.getElementById("navAddProductBtn");

  if (openAddBtn) openAddBtn.addEventListener("click", () => openProductModal(openAddBtn, null));
  if (overviewAddBtn) overviewAddBtn.addEventListener("click", () => openProductModal(overviewAddBtn, null));
  if (navAddBtn) navAddBtn.addEventListener("click", () => openProductModal(navAddBtn, null));

  initProductModal({
    onProductSaved: (savedProduct, createPoAfter) => {
      products = getProducts();
      categories = getCategories();
      renderKPIs();
      renderOverviewLists();
      fillProductFilters();
      renderProductsTable();
      renderCategoriesTable();
      renderInventoryTable();
      fillProductSelects();

      if (createPoAfter) {
        switchTab("inventory");
        switchInventorySubtab("purchases");
        openCreatePurchaseModal({
          productId: savedProduct.id,
          productName: savedProduct.name,
          quantity: Math.max(1, savedProduct.stock || 10),
          unitCost: Math.round((savedProduct.price || 1000000) * 0.6)
        });
        showToast(`Đã lưu sản phẩm "${savedProduct.name}" (#${savedProduct.id}). Mời bạn nhập thông tin phiếu nhập đầu tiên.`);
      } else {
        switchTab("products");
      }
    }
  });

  // Event delegation cho tất cả nút [data-edit-product]
  document.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit-product]");
    if (!editBtn) return;
    const prodId = editBtn.dataset.editProduct;
    if (prodId) {
      openProductModal(editBtn, prodId);
    }
  });
}

'''

if old_modal_start in content and old_modal_end in content:
    idx1 = content.find(old_modal_start)
    idx2 = content.find(old_modal_end)
    content = content[:idx1] + new_modal_code + content[idx2:]
    print("Replaced old modal logic with initProductModal in admin.js.")
else:
    print("Warning: old modal section markers not found.")

# 5. Add URL action check in start()
old_start_tail = '''  initIcons();
}

start();'''

new_start_tail = '''  initIcons();

  // Xử lý action từ URL (action=add-product hoặc action=edit-product&id=...)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");
    const editId = urlParams.get("id");
    if (action === "add-product") {
      switchTab("products");
      setTimeout(() => openProductModal(null, null), 150);
    } else if (action === "edit-product" && editId) {
      switchTab("products");
      setTimeout(() => openProductModal(null, editId), 150);
    }
  } catch (_) {}
}

start();'''

if old_start_tail in content:
    content = content.replace(old_start_tail, new_start_tail, 1)
    print("Added URL action handler in start().")
else:
    print("Warning: old_start_tail not found.")

with open('js/admin.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Saved js/admin.js.")

